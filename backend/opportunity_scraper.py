"""
Heuristic extraction of scholarship / internship rows from WebScraper chunks.
Upserts into MongoDB collections; safe to run repeatedly (dedupe_key).
"""
from __future__ import annotations

import hashlib
import re
from collections import defaultdict
from datetime import datetime, timedelta
from typing import Any, Dict, List, Literal, Optional
from urllib.parse import urlparse

Chunk = Dict[str, Any]

INTERNSHIP_HINTS = re.compile(
    r"\b(internship|intern\b|placement|co-?op|trainee|summer\s+analyst|graduate\s+program|"
    r"early\s+career|apprentice|work\s+placement)\b",
    re.I,
)
SCHOLARSHIP_HINTS = re.compile(
    r"\b(scholarship|fellowship|grant|financial\s+aid|fully\s+funded|tuition\s+waive|"
    r"bursary|studentship|phd\s+funding|master'?s\s+funding)\b",
    re.I,
)

DATE_PATTERNS = [
    re.compile(
        r"\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})\b",
        re.I,
    ),
    re.compile(r"\b(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})\b"),
    re.compile(r"\b(\d{4})[/-](\d{1,2})[/-](\d{1,2})\b"),
]

_MONTHS = {
    "jan": 1,
    "feb": 2,
    "mar": 3,
    "apr": 4,
    "may": 5,
    "jun": 6,
    "jul": 7,
    "aug": 8,
    "sep": 9,
    "sept": 9,
    "oct": 10,
    "nov": 11,
    "dec": 12,
}


def _parse_deadline(text: str) -> Optional[datetime]:
    for pat in DATE_PATTERNS:
        m = pat.search(text)
        if not m:
            continue
        g = m.groups()
        try:
            if pat is DATE_PATTERNS[0]:
                mon = _MONTHS.get(g[0].lower()[:3], None)
                if not mon:
                    continue
                return datetime(int(g[2]), mon, int(g[1]))
            if pat is DATE_PATTERNS[1]:
                a, b, y = int(g[0]), int(g[1]), int(g[2])
                if y < 100:
                    y += 2000
                if a > 12:
                    return datetime(y, b, a)
                return datetime(y, a, b)
            if pat is DATE_PATTERNS[2]:
                return datetime(int(g[0]), int(g[1]), int(g[2]))
        except (ValueError, OverflowError):
            continue
    return None


def _default_deadline() -> datetime:
    return datetime.utcnow() + timedelta(days=365)


def _title_from_text(text: str, url: str) -> str:
    lines = [ln.strip() for ln in text.splitlines() if ln.strip()]
    if lines:
        t = lines[0][:200]
        if len(t) > 15:
            return t
    path = urlparse(url).path.strip("/").replace("-", " ").replace("/", " — ")
    return (path or urlparse(url).netloc)[:200] or "Opportunity"


def _infer_scholarship_type(text: str) -> str:
    low = text.lower()
    if re.search(r"\bphd\b|doctoral", low):
        return "phd"
    if "fully funded" in low or "full funding" in low:
        return "funded"
    if re.search(r"\bneed\b|financial aid|faFSA|means", low):
        return "need"
    return "merit"


def _guess_country(text: str) -> str:
    low = text.lower()
    pairs = [
        ("pakistan", "Pakistan"),
        ("united kingdom", "United Kingdom"),
        (" uk ", "United Kingdom"),
        ("u.k.", "United Kingdom"),
        ("usa", "United States"),
        ("united states", "United States"),
        ("u.s.", "United States"),
        ("canada", "Canada"),
        ("australia", "Australia"),
        ("germany", "Germany"),
        ("china", "China"),
        ("uae", "UAE"),
        ("turkey", "Turkey"),
    ]
    for needle, label in pairs:
        if needle in low:
            return label
    return "Various"


def _company_from_url(url: str) -> str:
    host = urlparse(url).netloc.lower()
    host = re.sub(r"^www\.", "", host)
    return host.split(".")[0].replace("-", " ").title() or "Organization"


def _infer_field(text: str) -> str:
    low = text.lower()
    if any(
        x in low
        for x in (
            "computer science",
            "software",
            "developer",
            "data science",
            "machine learning",
            " cs ",
        )
    ):
        return "Computer Science / IT"
    if any(x in low for x in ("engineering", "mechanical", "electrical", "civil")):
        return "Engineering"
    if any(x in low for x in ("business", "finance", "marketing", "management")):
        return "Business"
    if any(x in low for x in ("biology", "chemistry", "physics", "research lab")):
        return "Science / Research"
    return "General"


def _classify(text: str, url: str) -> Literal["scholarship", "internship", "skip"]:
    u = url.lower()
    # URL-path priority keeps category pages from being misclassified by mixed text.
    if "/internship" in u:
        return "internship"
    if "/scholarship" in u or "scholarships" in u or "fellowship" in u:
        return "scholarship"
    si = bool(SCHOLARSHIP_HINTS.search(text))
    ii = bool(INTERNSHIP_HINTS.search(text))
    if si and not ii:
        return "scholarship"
    if ii and not si:
        return "internship"
    if si and ii:
        return "scholarship" if len(SCHOLARSHIP_HINTS.findall(text)) >= len(
            INTERNSHIP_HINTS.findall(text)
        ) else "internship"
    if si:
        return "scholarship"
    if ii:
        return "internship"
    return "skip"


def _dedupe_key(kind: str, url: str, title: str) -> str:
    raw = f"{kind}|{url}|{title[:120]}".encode("utf-8", "ignore")
    return hashlib.sha256(raw).hexdigest()[:20]


def persist_opportunities_from_chunks(
    chunks: List[Chunk],
    scholarships_col,
    internships_col,
) -> Dict[str, int]:
    """Merge chunks by URL, classify, upsert into Mongo."""
    if not chunks:
        return {"scholarships_upserted": 0, "internships_upserted": 0, "skipped": 0}

    by_url: Dict[str, List[Chunk]] = defaultdict(list)
    for c in chunks:
        by_url[c["url"]].append(c)

    sch_added = intern_added = skipped = 0
    now = datetime.utcnow()
    scraped_at = now

    for url, group in by_url.items():
        texts = sorted({x["text"].strip() for x in group if x.get("text")}, key=len, reverse=True)
        if not texts:
            skipped += 1
            continue
        text = "\n\n".join(texts[:4])[:8000]
        kind = _classify(text, url)
        if kind == "skip":
            skipped += 1
            continue

        title = _title_from_text(text, url)
        deadline = _parse_deadline(text) or _default_deadline()
        elig = text[:1500].strip()

        if kind == "scholarship":
            dk = _dedupe_key("s", url, title)
            doc = {
                "title": title,
                "type": _infer_scholarship_type(text),
                "country": _guess_country(text),
                "university": "",
                "amount": None,
                "deadline": deadline,
                "eligibility": elig
                + "\n\n[Auto-scraped — verify deadline and details on the official page.]",
                "source_url": url,
                "apply_url": url,
                "is_fully_funded": "fully funded" in text.lower() or "full funding" in text.lower(),
                "scraped_at": scraped_at,
                "dedupe_key": dk,
                "created_at": now,
                "updated_at": now,
            }
            scholarships_col.update_one(
                {"dedupe_key": dk},
                {"$set": {k: v for k, v in doc.items() if k != "created_at"}, "$setOnInsert": {"created_at": now}},
                upsert=True,
            )
            sch_added += 1
        else:
            dk = _dedupe_key("i", url, title)
            loc = _guess_country(text)
            if "remote" in text.lower():
                loc = "Remote"
            doc = {
                "title": title,
                "company": _company_from_url(url),
                "location": loc,
                "is_paid": bool(re.search(r"\b(paid|stipend|salary|competitive\s+pay)\b", text, re.I)),
                "stipend": None,
                "duration_weeks": None,
                "deadline": deadline,
                "field": _infer_field(text),
                "apply_url": url,
                "scraped_at": scraped_at,
                "dedupe_key": dk,
                "description_excerpt": elig[:800],
                "created_at": now,
                "updated_at": now,
            }
            internships_col.update_one(
                {"dedupe_key": dk},
                {"$set": {k: v for k, v in doc.items() if k != "created_at"}, "$setOnInsert": {"created_at": now}},
                upsert=True,
            )
            intern_added += 1

    return {
        "scholarships_upserted": sch_added,
        "internships_upserted": intern_added,
        "skipped": skipped,
    }
