import io
import os
import re
from typing import Optional

from PIL import Image
import pytesseract
from docx import Document
from pypdf import PdfReader
from pdf2image import convert_from_bytes


def _normalize_text(text: str) -> str:
    return "\n".join(line.strip() for line in text.splitlines() if line.strip())


def _extract_text_from_pdf_bytes(content: bytes) -> str:
    text_parts = []
    try:
        reader = PdfReader(io.BytesIO(content))
        for page in reader.pages:
            try:
                text = page.extract_text() or ""
            except Exception:
                text = ""
            if text:
                text_parts.append(text)
    except Exception as exc:
        raise RuntimeError(f"PDF extraction failed: {exc}")

    text = _normalize_text("\n".join(text_parts))
    return text


def _ocr_image_bytes(content: bytes) -> str:
    try:
        image = Image.open(io.BytesIO(content))
        if image.mode not in ("RGB", "L"):
            image = image.convert("RGB")
        return pytesseract.image_to_string(image)
    except Exception as exc:
        print(f"Image OCR failed: {exc}")
        return "[Image CV uploaded. OCR is not configured or failed on this server.]"


def _ocr_pdf_bytes(content: bytes) -> str:
    try:
        images = convert_from_bytes(content, dpi=200)
    except Exception as exc:
        raise RuntimeError(f"PDF OCR conversion failed: {exc}")

    text_parts = []
    for image in images:
        try:
            text_parts.append(pytesseract.image_to_string(image))
        except Exception:
            continue
    return _normalize_text("\n".join(text_parts))


def extract_text_from_cv(file_path: str, filename: str, content_type: Optional[str] = None) -> str:
    ext = os.path.splitext(filename or "")[1].lower()
    ext = ext or (".pdf" if content_type and "pdf" in content_type.lower() else "")

    if not os.path.exists(file_path):
        raise FileNotFoundError(f"CV file not found: {file_path}")

    if ext in (".pdf",):
        with open(file_path, "rb") as f:
            raw = f.read()
        text = _extract_text_from_pdf_bytes(raw)
        if len(text.split()) < 40:
            try:
                ocr_text = _ocr_pdf_bytes(raw)
                if ocr_text.strip():
                    text = f"{text}\n{ocr_text}" if text else ocr_text
            except Exception:
                pass
        if not text.strip():
            return "[Scanned PDF CV uploaded. OCR is not configured or failed on this server.]"
        return text

    if ext == ".docx":
        try:
            document = Document(file_path)
            text = "\n".join(paragraph.text for paragraph in document.paragraphs)
        except Exception as exc:
            raise RuntimeError(f"DOCX extraction failed: {exc}")
        if not text.strip():
            raise ValueError("Unable to extract readable text from DOCX CV")
        return text

    if ext == ".txt":
        try:
            with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
                text = f.read()
        except Exception as exc:
            raise RuntimeError(f"TXT extraction failed: {exc}")
        if not text.strip():
            raise ValueError("Unable to extract readable text from TXT CV")
        return text

    if ext in (".jpg", ".jpeg", ".png", ".webp"):
        with open(file_path, "rb") as f:
            raw = f.read()
        text = _ocr_image_bytes(raw)
        if not text.strip():
            return "[Image CV uploaded. OCR is not configured or failed on this server.]"
        return text

    raise ValueError("Unsupported CV file format")
