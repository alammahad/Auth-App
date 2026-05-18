from typing import List, Dict, Any

class VectorStore:
    def __init__(self):
        self._chunks: List[Dict[str, Any]] = []

    def clear(self) -> None:
        self._chunks = []

    def count(self) -> int:
        return len(self._chunks)

    def add_chunks(self, chunks: List[str], url: str, metadata_extra: Dict[str, Any] | None = None) -> int:
        metadata_extra = metadata_extra or {}
        stored = 0
        for text in chunks:
            self._chunks.append({
                "text": text,
                "url": url,
                "source_domain": metadata_extra.get("source_domain", ""),
                "scraped_at": metadata_extra.get("scraped_at", ""),
                **metadata_extra,
            })
            stored += 1
        return stored

    def query(self, question: str, top_k: int = 5) -> List[Dict[str, Any]]:
        if not self._chunks:
            return []
        normalized = question.lower().strip()
        matches = []
        for chunk in self._chunks:
            score = 0
            text = chunk.get("text", "").lower()
            if normalized in text:
                score += 10
            for word in normalized.split():
                if word and word in text:
                    score += 1
            matches.append((score, chunk))
        matches.sort(key=lambda item: item[0], reverse=True)
        return [chunk for score, chunk in matches[:top_k] if score > 0] or self._chunks[:top_k]
