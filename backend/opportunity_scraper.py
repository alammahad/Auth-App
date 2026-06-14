"""
Heuristic extraction of scholarship / internship rows from WebScraper chunks.
Upserts into MongoDB collections; safe to run repeatedly (dedupe_key).
All internship documents are fully normalized with:
  - workplace_type  : "remote" | "hybrid" | "onsite"
  - country         : str or None (None when remote)
  - city            : str or None
  - has_stipend     : bool
  - stipend         : float or None
  - stipend_currency: str or None
  - duration_weeks  : int or None
"""
from __future__ import annotations

import hashlib
import re
from collections import defaultdict
from datetime import datetime, timedelta
from typing import Any, Dict, List, Literal, Optional, Tuple
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
    re.compile(
        r"\b(\d{1,2})(?:st|nd|rd|th)?\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\.?,?\s+(\d{4})\b",
        re.I,
    ),
]

_MONTHS = {
    "jan": 1, "feb": 2, "mar": 3, "apr": 4,
    "may": 5, "jun": 6, "jul": 7, "aug": 8,
    "sep": 9, "sept": 9, "oct": 10, "nov": 11, "dec": 12,
}

# ─── Country / City lookup tables ────────────────────────────────────────────

_COUNTRY_PAIRS = [
    ("pakistan", "Pakistan"),
    ("united kingdom", "United Kingdom"),
    (" uk ", "United Kingdom"),
    ("u.k.", "United Kingdom"),
    ("united states", "United States"),
    (" usa ", "United States"),
    ("u.s.a", "United States"),
    ("u.s.", "United States"),
    ("canada", "Canada"),
    ("australia", "Australia"),
    ("germany", "Germany"),
    ("china", "China"),
    ("japan", "Japan"),
    ("south korea", "South Korea"),
    (" korea ", "South Korea"),
    ("turkey", "Turkey"),
    ("türkiye", "Turkey"),
    ("sweden", "Sweden"),
    ("netherlands", "Netherlands"),
    ("new zealand", "New Zealand"),
    ("saudi arabia", "Saudi Arabia"),
    ("france", "France"),
    ("italy", "Italy"),
    ("spain", "Spain"),
    ("switzerland", "Switzerland"),
    ("singapore", "Singapore"),
    ("malaysia", "Malaysia"),
    ("ireland", "Ireland"),
    ("belgium", "Belgium"),
    ("finland", "Finland"),
    ("norway", "Norway"),
    ("denmark", "Denmark"),
    ("austria", "Austria"),
    ("hong kong", "Hong Kong"),
    (" uae ", "UAE"),
    ("united arab emirates", "UAE"),
    ("india", "India"),
    ("brazil", "Brazil"),
    ("mexico", "Mexico"),
    ("poland", "Poland"),
    ("czech republic", "Czech Republic"),
    ("czechia", "Czech Republic"),
    ("portugal", "Portugal"),
    ("greece", "Greece"),
    ("hungary", "Hungary"),
    ("romania", "Romania"),
    ("indonesia", "Indonesia"),
    ("vietnam", "Vietnam"),
    ("thailand", "Thailand"),
    ("philippines", "Philippines"),
    ("bangladesh", "Bangladesh"),
    ("egypt", "Egypt"),
    ("nigeria", "Nigeria"),
    ("kenya", "Kenya"),
    ("south africa", "South Africa"),
    ("israel", "Israel"),
    ("qatar", "Qatar"),
    ("kuwait", "Kuwait"),
    ("jordan", "Jordan"),
    ("russia", "Russia"),
    ("ukraine", "Ukraine"),
    ("taiwan", "Taiwan"),
]

# City → Country mapping for normalization
_CITY_COUNTRY: List[Tuple[str, str, str]] = [
    # (keyword in text, city name, country name)
    ("london", "London", "United Kingdom"),
    ("manchester", "Manchester", "United Kingdom"),
    ("edinburgh", "Edinburgh", "United Kingdom"),
    ("birmingham", "Birmingham", "United Kingdom"),
    ("new york", "New York", "United States"),
    ("san francisco", "San Francisco", "United States"),
    ("silicon valley", "San Francisco", "United States"),
    ("seattle", "Seattle", "United States"),
    ("boston", "Boston", "United States"),
    ("chicago", "Chicago", "United States"),
    ("los angeles", "Los Angeles", "United States"),
    ("austin", "Austin", "United States"),
    ("washington dc", "Washington D.C.", "United States"),
    ("washington, d.c", "Washington D.C.", "United States"),
    ("toronto", "Toronto", "Canada"),
    ("vancouver", "Vancouver", "Canada"),
    ("montreal", "Montreal", "Canada"),
    ("berlin", "Berlin", "Germany"),
    ("munich", "Munich", "Germany"),
    ("hamburg", "Hamburg", "Germany"),
    ("frankfurt", "Frankfurt", "Germany"),
    ("paris", "Paris", "France"),
    ("amsterdam", "Amsterdam", "Netherlands"),
    ("rotterdam", "Rotterdam", "Netherlands"),
    ("zurich", "Zurich", "Switzerland"),
    ("geneva", "Geneva", "Switzerland"),
    ("stockholm", "Stockholm", "Sweden"),
    ("oslo", "Oslo", "Norway"),
    ("copenhagen", "Copenhagen", "Denmark"),
    ("helsinki", "Helsinki", "Finland"),
    ("vienna", "Vienna", "Austria"),
    ("brussels", "Brussels", "Belgium"),
    ("sydney", "Sydney", "Australia"),
    ("melbourne", "Melbourne", "Australia"),
    ("singapore", "Singapore", "Singapore"),
    ("hong kong", "Hong Kong", "Hong Kong"),
    ("tokyo", "Tokyo", "Japan"),
    ("seoul", "Seoul", "South Korea"),
    ("beijing", "Beijing", "China"),
    ("shanghai", "Shanghai", "China"),
    ("shenzhen", "Shenzhen", "China"),
    ("dubai", "Dubai", "UAE"),
    ("abu dhabi", "Abu Dhabi", "UAE"),
    ("karachi", "Karachi", "Pakistan"),
    ("lahore", "Lahore", "Pakistan"),
    ("islamabad", "Islamabad", "Pakistan"),
    ("bangalore", "Bangalore", "India"),
    ("mumbai", "Mumbai", "India"),
    ("delhi", "Delhi", "India"),
    ("hyderabad", "Hyderabad", "India"),
    ("pune", "Pune", "India"),
    ("madrid", "Madrid", "Spain"),
    ("barcelona", "Barcelona", "Spain"),
    ("milan", "Milan", "Italy"),
    ("rome", "Rome", "Italy"),
    ("warsaw", "Warsaw", "Poland"),
    ("prague", "Prague", "Czech Republic"),
    ("istanbul", "Istanbul", "Turkey"),
    ("cairo", "Cairo", "Egypt"),
    ("nairobi", "Nairobi", "Kenya"),
    ("johannesburg", "Johannesburg", "South Africa"),
    ("cape town", "Cape Town", "South Africa"),
    ("sao paulo", "São Paulo", "Brazil"),
    ("mexico city", "Mexico City", "Mexico"),
    ("riyadh", "Riyadh", "Saudi Arabia"),
    ("doha", "Doha", "Qatar"),
    ("tel aviv", "Tel Aviv", "Israel"),
    ("taipei", "Taipei", "Taiwan"),
    ("jakarta", "Jakarta", "Indonesia"),
    ("kuala lumpur", "Kuala Lumpur", "Malaysia"),
    ("bangkok", "Bangkok", "Thailand"),
    ("ho chi minh", "Ho Chi Minh City", "Vietnam"),
    ("manila", "Manila", "Philippines"),
    ("dhaka", "Dhaka", "Bangladesh"),
    ("moscow", "Moscow", "Russia"),
    ("kyiv", "Kyiv", "Ukraine"),
]

# ─── Stipend / currency detection ────────────────────────────────────────────

_CURRENCY_PATTERNS = [
    # (regex pattern, currency code)
    (re.compile(r"€\s*[\d,]+|[\d,]+\s*€|eur\b", re.I), "EUR"),
    (re.compile(r"\$\s*[\d,]+|[\d,]+\s*\$|usd\b|us\s*dollar", re.I), "USD"),
    (re.compile(r"£\s*[\d,]+|[\d,]+\s*£|gbp\b|pound\b", re.I), "GBP"),
    (re.compile(r"cad\b|c\$|canadian\s+dollar", re.I), "CAD"),
    (re.compile(r"aud\b|a\$|australian\s+dollar", re.I), "AUD"),
    (re.compile(r"pkr\b|rs\.?\s*[\d,]+|rupee", re.I), "PKR"),
    (re.compile(r"sgd\b|s\$|singapore\s+dollar", re.I), "SGD"),
    (re.compile(r"¥\s*[\d,]+|jpy\b|yen\b", re.I), "JPY"),
    (re.compile(r"inr\b|₹\s*[\d,]+|indian\s+rupee", re.I), "INR"),
]

_STIPEND_AMOUNT_RE = re.compile(
    r"(?:stipend|salary|pay|compensation|remuneration|allowance)[^\d]*"
    r"([\d,]+(?:\.\d+)?)\s*(?:k\b)?",
    re.I,
)

_GENERIC_AMOUNT_RE = re.compile(
    r"(?:€|£|\$|¥|₹)\s*([\d,]+(?:\.\d+)?)(?:\s*k\b)?|"
    r"([\d,]+(?:\.\d+)?)\s*(?:k\b)?\s*(?:€|£|usd|eur|gbp|cad|aud|pkr|sgd)/",
    re.I,
)

_DURATION_RE = re.compile(
    r"(\d+)\s*(?:-\s*\d+\s*)?(?:week|wk|month|months?)s?\b",
    re.I,
)


# ─── Helper functions ─────────────────────────────────────────────────────────

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
            if pat is DATE_PATTERNS[3]:
                mon = _MONTHS.get(g[1].lower()[:3], None)
                if not mon:
                    continue
                return datetime(int(g[2]), mon, int(g[0]))
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
    """Best-effort country from free text. Returns 'Various' if ambiguous."""
    low = text.lower()
    for needle, label in _COUNTRY_PAIRS:
        if needle in low:
            return label
    return "Various"


def _guess_city_and_country(text: str) -> Tuple[Optional[str], Optional[str]]:
    """Returns (city, country) by scanning text for known city names."""
    low = text.lower()
    for keyword, city, country in _CITY_COUNTRY:
        if keyword in low:
            return city, country
    return None, None


def _infer_workplace_type(text: str) -> str:
    """Classify as 'remote', 'hybrid', or 'onsite' from text signals."""
    low = text.lower()
    is_remote = bool(re.search(r"\bremote\b|work\s+from\s+home|wfh|fully\s+remote|100%\s+remote", low))
    is_hybrid = bool(re.search(r"\bhybrid\b|partially\s+remote|flexible\s+work|mixed\s+mode", low))
    is_onsite = bool(re.search(r"\bon[\s-]?site\b|in[\s-]?office\b|in[\s-]?person\b|physically\s+present", low))

    if is_remote and not is_hybrid and not is_onsite:
        return "remote"
    if is_hybrid:
        return "hybrid"
    if is_remote and is_onsite:
        return "hybrid"
    return "onsite"


def _extract_duration_weeks(text: str) -> Optional[int]:
    """Extract duration in weeks. Converts months to weeks (×4.3)."""
    m = _DURATION_RE.search(text)
    if not m:
        return None
    val = int(m.group(1))
    raw = m.group(0).lower()
    if "month" in raw:
        return round(val * 4)   # 1 month ≈ 4 weeks
    return val  # already weeks


def _extract_stipend(text: str) -> Tuple[Optional[float], Optional[str]]:
    """Extract stipend amount and currency from text."""
    # Detect currency first
    currency = None
    for pat, code in _CURRENCY_PATTERNS:
        if pat.search(text):
            currency = code
            break

    # Try to find explicit "stipend: $X" pattern first
    m = _STIPEND_AMOUNT_RE.search(text)
    if not m:
        m = _GENERIC_AMOUNT_RE.search(text)

    if m:
        raw = m.group(1) or m.group(2) or ""
        raw = raw.replace(",", "")
        try:
            amount = float(raw)
            # Handle "k" suffix (e.g. "1.2k" → 1200)
            if re.search(r"\d\s*k\b", m.group(0), re.I):
                amount *= 1000
            if amount > 0:
                return amount, currency or "USD"
        except ValueError:
            pass

    return None, None


def _company_from_url(url: str) -> str:
    host = urlparse(url).netloc.lower()
    host = re.sub(r"^www\.", "", host)
    return host.split(".")[0].replace("-", " ").title() or "Organization"


def _infer_source_name(url: str, text: str) -> str:
    low_text = text.lower()
    low_url = url.lower()

    if "chevening" in low_url or "chevening" in low_text:
        return "Chevening"
    if "daad" in low_url or "daad" in low_text:
        return "DAAD"
    if "mext" in low_url or "mext" in low_text or "studyinjapan" in low_url:
        return "MEXT"
    if "erasmus" in low_url or "erasmus" in low_text:
        return "Erasmus+"
    if "gates cambridge" in low_url or "gates cambridge" in low_text:
        return "Gates Cambridge"
    if "rhodes" in low_url or "rhodes" in low_text:
        return "Rhodes Scholarship"
    if "knight-hennessy" in low_url or "knight-hennessy" in low_text:
        return "Knight-Hennessy Scholars"
    if "vanier" in low_url or "vanier" in low_text:
        return "Vanier CGS"
    if "banting" in low_url or "banting" in low_text:
        return "Banting Fellowships"
    if "hec.gov.pk" in low_url or "hec scholarship" in low_text:
        return "HEC Pakistan"
    if "isdb" in low_url or "islamic development bank" in low_text:
        return "Islamic Development Bank"
    if "worldbank" in low_url or "world bank" in low_text:
        return "World Bank"
    if "adb.org" in low_url or "asian development bank" in low_text:
        return "Asian Development Bank"
    if "turkiyeburslari" in low_url or "turkey scholarship" in low_text:
        return "Türkiye Bursları"

    return _company_from_url(url)


def _infer_degree_level(text: str) -> str:
    low = text.lower()
    levels = []
    if any(x in low for x in ["phd", "doctoral", "doctor of philosophy", "ph.d"]):
        levels.append("PhD")
    if any(x in low for x in ["master", "postgraduate", "ms", "msc", "ma", "m.phil"]):
        levels.append("Masters")
    if any(x in low for x in ["bachelor", "undergraduate", "bs", "bsc", "ba"]):
        levels.append("Bachelors")
    if any(x in low for x in ["postdoc", "postdoctoral"]):
        levels.append("Postdoc")
    if levels:
        return "/".join(levels)
    return "Bachelors/Masters/PhD"


def _infer_funding_type(text: str) -> str:
    low = text.lower()
    if any(x in low for x in ["fully funded", "full funding", "tuition and stipend", "full tuition", "100% tuition"]):
        return "Full"
    if any(x in low for x in ["partial", "half", "contribution", "50%", "30%", "20%"]):
        return "Partial"
    if any(x in low for x in ["tuition fee waiver", "tuition only", "covers tuition"]):
        return "Tuition-only"
    if any(x in low for x in ["stipend", "monthly allowance", "living allowance"]):
        return "Stipend"
    return "Varies"


def _infer_field(text: str) -> str:
    low = text.lower()
    if any(x in low for x in (
        "computer science", "software", "developer", "data science",
        "machine learning", "artificial intelligence", " ai ", "deep learning",
        " cs ", "programming", "web development", "information technology",
        "cybersecurity", "cloud", "devops", "backend", "frontend",
    )):
        return "Computer Science / IT"
    if any(x in low for x in ("engineering", "mechanical", "electrical", "civil", "chemical", "aerospace")):
        return "Engineering"
    if any(x in low for x in ("business", "finance", "marketing", "management", "accounting", "economics", "consulting", "sales", "hr ", "human resources")):
        return "Business"
    if any(x in low for x in ("biology", "chemistry", "physics", "research lab", "scientific", "mathematics", "biomedical", "medical", "healthcare", "pharma", "life science")):
        return "Science / Research"
    if any(x in low for x in ("design", "ui/ux", "ux design", "product design", "graphic", "creative", "media", "journalism", "content writer", "copywriting", "social media")):
        return "Arts / Design / Media"
    if any(x in low for x in ("law", "legal", "policy", "governance", "public policy", "international relations")):
        return "Law / Policy"
    if any(x in low for x in ("education", "teaching", "tutoring", "curriculum", "pedagogy")):
        return "Education"
    return "General"


def _classify(text: str, url: str) -> Literal["scholarship", "internship", "skip"]:
    u = url.lower()
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


# ─── Normalization for a single internship text block ────────────────────────

def normalize_internship_fields(text: str, url: str = "") -> dict:
    """
    Given raw scraped text, return a dict of all normalized internship fields.
    Called both during scraping AND during backfill migration of old records.
    """
    workplace_type = _infer_workplace_type(text)
    city, country_from_city = _guess_city_and_country(text)

    # Country: prefer city-derived, fall back to text scan
    if country_from_city:
        country = country_from_city
    elif workplace_type == "remote":
        country = None   # remote has no single country
    else:
        raw_country = _guess_country(text)
        country = None if raw_country == "Various" else raw_country

    # For remote roles, don't assign a city
    if workplace_type == "remote":
        city = None
        country = None

    stipend_amount, stipend_currency = _extract_stipend(text)
    is_paid = bool(
        stipend_amount or
        re.search(r"\b(paid|stipend|salary|competitive\s+pay|remuneration|compensation)\b", text, re.I)
    )
    has_stipend = bool(stipend_amount)

    duration_weeks = _extract_duration_weeks(text)

    return {
        "workplace_type": workplace_type,
        "country": country,
        "city": city,
        "is_paid": is_paid,
        "has_stipend": has_stipend,
        "stipend": stipend_amount,
        "stipend_currency": stipend_currency,
        "duration_weeks": duration_weeks,
        "field": _infer_field(text),
    }


# ─── Backfill helper ─────────────────────────────────────────────────────────

def backfill_internship_normalization(internships_col) -> int:
    """
    One-time migration: find all internships missing `workplace_type`
    and re-normalize them from their stored description_excerpt or location.
    Returns number of records updated.
    """
    missing = list(internships_col.find({"workplace_type": {"$exists": False}}))
    updated = 0
    for doc in missing:
        text = (doc.get("description_excerpt") or
                doc.get("eligibility") or
                f"{doc.get('title', '')} {doc.get('location', '')} {doc.get('company', '')}")
        url = doc.get("apply_url") or doc.get("source_url") or ""
        fields = normalize_internship_fields(text, url)
        internships_col.update_one(
            {"_id": doc["_id"]},
            {"$set": fields}
        )
        updated += 1
    return updated


# ─── Main persist function ────────────────────────────────────────────────────

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

        title = group[0].get("title")
        if title:
            title = title.strip()
        if not title:
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
                "source_name": _infer_source_name(url, text),
                "degree_level": _infer_degree_level(text),
                "funding_type": _infer_funding_type(text),
            }
            scholarships_col.update_one(
                {"dedupe_key": dk},
                {"$set": {k: v for k, v in doc.items() if k != "created_at"}, "$setOnInsert": {"created_at": now}},
                upsert=True,
            )
            sch_added += 1
        else:
            # ── Full normalization for internship ──
            dk = _dedupe_key("i", url, title)
            norm = normalize_internship_fields(text, url)

            # Build human-readable location string
            if norm["workplace_type"] == "remote":
                location_str = "Remote"
            elif norm["city"] and norm["country"]:
                location_str = f"{norm['city']}, {norm['country']}"
            elif norm["country"]:
                location_str = norm["country"]
            else:
                location_str = _guess_country(text)
                if location_str == "Various":
                    location_str = "Location not specified"

            doc = {
                "title": title,
                "company": _company_from_url(url),
                "location": location_str,
                "country": norm["country"],
                "city": norm["city"],
                "workplace_type": norm["workplace_type"],
                "is_paid": norm["is_paid"],
                "has_stipend": norm["has_stipend"],
                "stipend": norm["stipend"],
                "stipend_currency": norm["stipend_currency"],
                "duration_weeks": norm["duration_weeks"],
                "deadline": deadline,
                "field": norm["field"],
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
