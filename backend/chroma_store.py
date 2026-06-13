"""
ChromaDB-backed vector store for AI chat RAG.

Falls back to in-memory keyword search if chromadb is not installed.
Collection is persisted to ./chroma_db/ relative to this file.
"""
from __future__ import annotations

import os
import hashlib
from typing import Any, Dict, List, Optional
from datetime import datetime

CHROMA_DIR = os.path.join(os.path.dirname(__file__), "chroma_db")
COLLECTION_NAME = "ai_chat_knowledge"

try:
    import chromadb
    from chromadb.config import Settings
    _CHROMA_AVAILABLE = True
except ImportError:
    _CHROMA_AVAILABLE = False
    print("[ChromaStore] chromadb not installed — falling back to in-memory store.")


def _chunk_id(text: str, url: str) -> str:
    """Stable, short ID from content + URL."""
    raw = f"{url}|{text[:200]}"
    return hashlib.sha256(raw.encode("utf-8", "ignore")).hexdigest()[:32]


class ChromaStore:
    """
    Persistent ChromaDB vector store.

    If chromadb is not available, falls back to a simple in-memory keyword store
    so the rest of the application continues to work.
    """

    def __init__(self):
        self._client = None
        self._collection = None
        self._fallback: List[Dict[str, Any]] = []
        self._init_chroma()

    # ------------------------------------------------------------------
    # Initialisation
    # ------------------------------------------------------------------

    def _init_chroma(self) -> None:
        if not _CHROMA_AVAILABLE:
            return
        try:
            os.makedirs(CHROMA_DIR, exist_ok=True)
            self._client = chromadb.PersistentClient(
                path=CHROMA_DIR,
                settings=Settings(anonymized_telemetry=False),
            )
            self._collection = self._client.get_or_create_collection(
                name=COLLECTION_NAME,
                metadata={"hnsw:space": "cosine"},
            )
            print(
                f"[ChromaStore] Connected — {self._collection.count()} docs in '{COLLECTION_NAME}'"
            )
        except Exception as e:
            print(f"[ChromaStore] Init error: {e} — falling back to in-memory.")
            self._client = None
            self._collection = None

    # ------------------------------------------------------------------
    # Public API  (mirrors VectorStore interface)
    # ------------------------------------------------------------------

    def clear(self) -> None:
        """Remove all documents from the collection."""
        if self._collection is not None:
            try:
                existing = self._collection.get()
                if existing["ids"]:
                    self._collection.delete(ids=existing["ids"])
                print("[ChromaStore] Collection cleared.")
            except Exception as e:
                print(f"[ChromaStore] clear error: {e}")
        else:
            self._fallback = []

    def count(self) -> int:
        if self._collection is not None:
            try:
                return self._collection.count()
            except Exception:
                return 0
        return len(self._fallback)

    def add_chunks(
        self,
        chunks: List[str],
        url: str,
        metadata_extra: Optional[Dict[str, Any]] = None,
    ) -> int:
        """Embed and upsert text chunks. Returns number of chunks stored."""
        metadata_extra = metadata_extra or {}
        stored = 0

        if self._collection is not None:
            ids, texts, metas = [], [], []
            for text in chunks:
                doc_id = _chunk_id(text, url)
                ids.append(doc_id)
                texts.append(text)
                meta: Dict[str, Any] = {
                    "url": url,
                    "source_domain": str(metadata_extra.get("source_domain", "")),
                    "scraped_at": str(
                        metadata_extra.get("scraped_at", datetime.utcnow().isoformat())
                    ),
                }
                metas.append(meta)

            try:
                # upsert handles duplicates gracefully
                self._collection.upsert(ids=ids, documents=texts, metadatas=metas)
                stored = len(ids)
            except Exception as e:
                print(f"[ChromaStore] add_chunks error: {e}")
        else:
            # fallback: plain list
            for text in chunks:
                self._fallback.append(
                    {
                        "text": text,
                        "url": url,
                        "source_domain": metadata_extra.get("source_domain", ""),
                        "scraped_at": metadata_extra.get(
                            "scraped_at", datetime.utcnow().isoformat()
                        ),
                    }
                )
                stored += 1

        return stored

    def query(self, question: str, top_k: int = 5) -> List[Dict[str, Any]]:
        """Semantic search. Falls back to keyword match if ChromaDB unavailable."""
        if self._collection is not None and self._collection.count() > 0:
            try:
                results = self._collection.query(
                    query_texts=[question],
                    n_results=min(top_k, self._collection.count()),
                    include=["documents", "metadatas", "distances"],
                )
                docs = results.get("documents", [[]])[0]
                metas = results.get("metadatas", [[]])[0]
                distances = results.get("distances", [[]])[0]
                return [
                    {
                        "text": doc,
                        "url": meta.get("url", ""),
                        "source_domain": meta.get("source_domain", ""),
                        "scraped_at": meta.get("scraped_at", ""),
                        "score": round(1 - dist, 4),  # cosine similarity
                    }
                    for doc, meta, dist in zip(docs, metas, distances)
                ]
            except Exception as e:
                print(f"[ChromaStore] query error: {e}")
                return []

        # Fallback keyword scoring
        if not self._fallback:
            return []
        normalized = question.lower().strip()
        scored = []
        for chunk in self._fallback:
            score = 0
            text = chunk.get("text", "").lower()
            if normalized in text:
                score += 10
            for word in normalized.split():
                if word and word in text:
                    score += 1
            scored.append((score, chunk))
        scored.sort(key=lambda x: x[0], reverse=True)
        return [c for s, c in scored[:top_k] if s > 0] or self._fallback[:top_k]
