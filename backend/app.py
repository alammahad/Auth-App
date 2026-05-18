import os
import io
import copy
import asyncio
import anthropic
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException, Depends, WebSocket, WebSocketDisconnect, status, UploadFile, File, Form, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
from typing import List, Dict, Optional
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
from pymongo import ASCENDING, DESCENDING
from pymongo.errors import CollectionInvalid, OperationFailure
from datetime import datetime, timedelta

# ✅ Local imports
from scraper import WebScraper
from vector_store import VectorStore

from dotenv import load_dotenv
from bson import ObjectId
import bcrypt
import jwt
import json
import ipaddress
import re
import sys
import uuid
from urllib.parse import urlparse

from cv_reader import extract_text_from_cv
from cv_matcher import analyze_cv_against_job
from cloudinary_config import upload_image as upload_to_cloudinary

try:
    from backend.db import (
        mongo_db,
        mongo_db_read,
        users_col,
        posts_col,
        messages_col,
        conversations_col,
        dm_messages_col,
        dm_threads_col,
        scholarships_col,
        internships_col,
        applications_col,
        notifications_col,
        job_postings_col,
        r_users_col,
        r_posts_col,
        r_messages_col,
        r_dm_messages_col,
        r_dm_threads_col,
        r_scholarships_col,
        r_internships_col,
        r_applications_col,
        r_notifications_col,
        r_job_postings_col,
    )
except ImportError:
    from db import (
        mongo_db,
        mongo_db_read,
        users_col,
        posts_col,
        messages_col,
        conversations_col,
        dm_messages_col,
        dm_threads_col,
        scholarships_col,
        internships_col,
        applications_col,
        notifications_col,
        job_postings_col,
        r_users_col,
        r_posts_col,
        r_messages_col,
        r_dm_messages_col,
        r_dm_threads_col,
        r_scholarships_col,
        r_internships_col,
        r_applications_col,
        r_notifications_col,
        r_job_postings_col,
    )

load_dotenv()

CLOUDINARY_CLOUD_NAME = os.getenv("CLOUDINARY_CLOUD_NAME")
CLOUDINARY_API_KEY = os.getenv("CLOUDINARY_API_KEY")
CLOUDINARY_API_SECRET = os.getenv("CLOUDINARY_API_SECRET")
PUBLIC_BACKEND_URL = os.getenv("PUBLIC_BACKEND_URL", "http://127.0.0.1:8000").rstrip("/")
LOCAL_UPLOAD_DIR = os.path.join(os.path.dirname(__file__), "uploads")
CLOUDINARY_CONFIGURED = bool(
    CLOUDINARY_CLOUD_NAME and CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET
)
if CLOUDINARY_CONFIGURED:
    import cloudinary

    cloudinary.config(
        cloud_name=CLOUDINARY_CLOUD_NAME,
        api_key=CLOUDINARY_API_KEY,
        api_secret=CLOUDINARY_API_SECRET,
    )

os.makedirs(LOCAL_UPLOAD_DIR, exist_ok=True)

# Dev performance toggle:
# set ENABLE_STARTUP_SCRAPE=false in backend/.env to avoid heavy scraping on every restart.
ENABLE_STARTUP_SCRAPE = os.getenv("ENABLE_STARTUP_SCRAPE", "false").strip().lower() in {
    "1",
    "true",
    "yes",
    "on",
}

# Windows consoles can default to cp1252; force UTF-8 output so log emojis
# from scraper/background jobs never crash the process.
try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

# ═══════════════════════════════════════════════════════
# PASSWORD HASHING
# ═══════════════════════════════════════════════════════

def hash_password(password: str) -> str:
    return bcrypt.hashpw(
        password.encode("utf-8"),
        bcrypt.gensalt(rounds=12),
    ).decode("utf-8")

def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(
            plain.encode("utf-8"),
            hashed.encode("utf-8"),
        )
    except (ValueError, TypeError):
        return False

# ═══════════════════════════════════════════════════════
# JWT CONFIG
# ═══════════════════════════════════════════════════════

JWT_SECRET = os.getenv("JWT_SECRET")
if not JWT_SECRET:
    # FIX: Never fall back to a hardcoded secret — fail loudly at startup
    raise ValueError("JWT_SECRET is missing in .env — set a strong random secret")

JWT_ALGORITHM    = "HS256"
JWT_EXPIRE_HOURS = 24 * 7  # 7 days

ADMIN_EMAIL = os.getenv("SUPER_ADMIN_EMAIL", "admin@sclr.com")
ADMIN_PASSWORD = os.getenv("SUPER_ADMIN_PASSWORD", "Admin123!")
SUPER_ADMIN_ID = "super_admin"

security = HTTPBearer()

def create_access_token(user_id: str, email: str) -> str:
    payload = {
        "sub": user_id,
        "email": email,
        "iat": datetime.utcnow(),
        "exp": datetime.utcnow() + timedelta(hours=JWT_EXPIRE_HOURS),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

def decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> dict:
    return decode_token(credentials.credentials)

def get_current_user_id(credentials: HTTPAuthorizationCredentials = Depends(security)) -> str:
    payload = decode_token(credentials.credentials)
    return payload["sub"]

# ═══════════════════════════════════════════════════════
# SSRF GUARD
# FIX: Validate that user-supplied scrape URLs point to
#      public internet addresses only — never internal IPs.
# ═══════════════════════════════════════════════════════

_PRIVATE_NETWORKS = [
    ipaddress.ip_network("10.0.0.0/8"),
    ipaddress.ip_network("172.16.0.0/12"),
    ipaddress.ip_network("192.168.0.0/16"),
    ipaddress.ip_network("127.0.0.0/8"),
    ipaddress.ip_network("169.254.0.0/16"),
    ipaddress.ip_network("::1/128"),
    ipaddress.ip_network("fc00::/7"),
]

def _is_safe_url(url: str) -> bool:
    """Return True only for http/https URLs pointing to public IP ranges."""
    try:
        parsed = urlparse(url)
        if parsed.scheme not in ("http", "https"):
            return False
        hostname = parsed.hostname
        if not hostname:
            return False
        # Reject raw private IPs
        try:
            addr = ipaddress.ip_address(hostname)
            return not any(addr in net for net in _PRIVATE_NETWORKS)
        except ValueError:
            # It's a hostname — reject obviously internal names
            bad_suffixes = (".local", ".internal", ".localhost", ".corp", ".lan")
            return not any(hostname.lower().endswith(s) for s in bad_suffixes)
    except Exception:
        return False

def validate_scrape_urls(urls: List[str]) -> List[str]:
    safe = [u for u in urls if _is_safe_url(u)]
    rejected = set(urls) - set(safe)
    if rejected:
        raise HTTPException(400, f"Rejected unsafe URLs: {list(rejected)}")
    return safe

def _is_valid_email(email: str) -> bool:
    if not email:
        return False
    return bool(re.fullmatch(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}", email.strip().lower()))


def _is_free_email_provider(email: str) -> bool:
    """Return True if the email domain is a well-known free provider (reject for recruiters)."""
    try:
        domain = email.split("@", 1)[1].lower()
    except Exception:
        return True
    free_domains = {
        "gmail.com",
        "yahoo.com",
        "hotmail.com",
        "outlook.com",
        "aol.com",
        "icloud.com",
        "msn.com",
    }
    return domain in free_domains

def _is_strong_password(password: str) -> bool:
    """
    Minimum security baseline:
    - at least 8 chars
    - 1 uppercase, 1 lowercase, 1 digit, 1 special char
    """
    if not password or len(password) < 8:
        return False
    has_upper = re.search(r"[A-Z]", password) is not None
    has_lower = re.search(r"[a-z]", password) is not None
    has_digit = re.search(r"\d", password) is not None
    has_special = re.search(r"[^A-Za-z0-9]", password) is not None
    return has_upper and has_lower and has_digit and has_special

# ═══════════════════════════════════════════════════════
# MONGODB — CENTRALIZED CONNECTION
# ═══════════════════════════════════════════════════════

# Collections are defined in backend/db.py so the entire app shares one centralized MongoDB configuration.


def get_super_admin_user() -> dict:
    return {
        "_id": SUPER_ADMIN_ID,
        "name": "Super Admin",
        "email": ADMIN_EMAIL,
        "user_type": "super_admin",
        "status": "approved",
        "handle": ADMIN_EMAIL.split("@")[0],
        "avatar": None,
        "bio": "System Administrator",
        "profile": {
            "role": "Platform Administrator",
            "contact_email": ADMIN_EMAIL,
            "organization": "ScholarAI",
        },
        "followers": [],
        "following": [],
        "saved_posts": [],
        "created_at": datetime.utcnow(),
        "updated_at": None,
    }


def get_user_by_token(current_user: dict) -> dict:
    if current_user["sub"] == SUPER_ADMIN_ID:
        return get_super_admin_user()
    return r_users_col.find_one({"_id": ObjectId(current_user["sub"])})

from opportunity_scraper import persist_opportunities_from_chunks
def _ensure_collection(name: str, validator: dict) -> None:
    try:
        mongo_db.create_collection(name, validator=validator)
    except CollectionInvalid:
        pass
    except OperationFailure:
        # Atlas shared tiers may restrict collMod/create validators; continue safely.
        pass


def init_database_schema() -> None:
    _ensure_collection(
        "users",
        {
            "$jsonSchema": {
                "bsonType": "object",
                "required": ["name", "email", "password", "user_type", "created_at"],
                "properties": {
                    "name": {"bsonType": "string"},
                    "email": {"bsonType": "string"},
                    "password": {"bsonType": "string"},
                    "user_type": {"enum": ["student", "recruiter", "super_admin"]},
                    "handle": {"bsonType": ["string", "null"]},
                    "avatar": {"bsonType": ["string", "null"]},
                    "bio": {"bsonType": ["string", "null"]},
                    "profile": {"bsonType": ["object", "null"]},
                    "followers": {"bsonType": "array"},
                    "following": {"bsonType": "array"},
                    "saved_posts": {"bsonType": "array"},
                    "created_at": {"bsonType": "date"},
                    "updated_at": {"bsonType": ["date", "null"]},
                },
            }
        },
    )

    _ensure_collection(
        "posts",
        {
            "$jsonSchema": {
                "bsonType": "object",
                "required": ["user_id", "text", "tag", "created_at"],
                "properties": {
                    "user_id": {"bsonType": "string"},
                    "text": {"bsonType": "string"},
                    "tag": {"bsonType": "string"},
                    "likes": {"bsonType": ["int", "long"]},
                    "liked_by": {"bsonType": "array"},
                    "comments": {"bsonType": "array"},
                    "saved_by": {"bsonType": "array"},
                    "image_url": {"bsonType": ["string", "null"]},
                    "created_at": {"bsonType": "date"},
                    "updated_at": {"bsonType": ["date", "null"]},
                },
            }
        },
    )

    _ensure_collection(
        "messages",
        {
            "$jsonSchema": {
                "bsonType": "object",
                "required": ["user_id", "conversation_id", "role", "content", "timestamp"],
                "properties": {
                    "user_id": {"bsonType": "string"},
                    "conversation_id": {"bsonType": "string"},
                    "role": {"enum": ["user", "assistant"]},
                    "content": {"bsonType": "string"},
                    "sources": {"bsonType": ["array", "null"]},
                    "timestamp": {"bsonType": "date"},
                },
            }
        },
    )

    _ensure_collection(
        "conversations",
        {
            "$jsonSchema": {
                "bsonType": "object",
                "required": ["user_id", "bot_type", "created_at"],
                "properties": {
                    "user_id": {"bsonType": "string"},
                    "title": {"bsonType": ["string", "null"]},
                    "bot_type": {"enum": ["merit", "need", "phd", "intern", "general", "funded"]},
                    "created_at": {"bsonType": "date"},
                    "updated_at": {"bsonType": ["date", "null"]},
                },
            }
        },
    )

    _ensure_collection(
        "dm_threads",
        {
            "$jsonSchema": {
                "bsonType": "object",
                "required": ["thread_id", "participants", "created_at", "updated_at"],
                "properties": {
                    "thread_id": {"bsonType": "string"},
                    "participants": {"bsonType": "array"},
                    "created_at": {"bsonType": "date"},
                    "updated_at": {"bsonType": "date"},
                },
            }
        },
    )

    _ensure_collection(
        "dm_messages",
        {
            "$jsonSchema": {
                "bsonType": "object",
                "required": ["thread_id", "sender_id", "text", "read", "created_at"],
                "properties": {
                    "thread_id": {"bsonType": "string"},
                    "sender_id": {"bsonType": "string"},
                    "sender_name": {"bsonType": ["string", "null"]},
                    "text": {"bsonType": "string"},
                    "read": {"bsonType": "bool"},
                    "created_at": {"bsonType": "date"},
                },
            }
        },
    )

    _ensure_collection(
        "scholarships",
        {
            "$jsonSchema": {
                "bsonType": "object",
                "required": ["title", "type", "country", "deadline", "apply_url", "created_at"],
                "properties": {
                    "title": {"bsonType": "string"},
                    "type": {"enum": ["merit", "need", "phd", "funded"]},
                    "country": {"bsonType": "string"},
                    "university": {"bsonType": "string"},
                    "amount": {"bsonType": ["double", "int", "long", "decimal", "null"]},
                    "deadline": {"bsonType": "date"},
                    "eligibility": {"bsonType": "string"},
                    "source_url": {"bsonType": "string"},
                    "apply_url": {"bsonType": "string"},
                    "is_fully_funded": {"bsonType": "bool"},
                    "scraped_at": {"bsonType": "date"},
                    "created_at": {"bsonType": "date"},
                    "updated_at": {"bsonType": ["date", "null"]},
                },
            }
        },
    )

    _ensure_collection(
        "internships",
        {
            "$jsonSchema": {
                "bsonType": "object",
                "required": ["title", "company", "location", "deadline", "apply_url", "created_at"],
                "properties": {
                    "title": {"bsonType": "string"},
                    "company": {"bsonType": "string"},
                    "location": {"bsonType": "string"},
                    "is_paid": {"bsonType": "bool"},
                    "stipend": {"bsonType": ["double", "int", "long", "decimal", "null"]},
                    "duration_weeks": {"bsonType": ["int", "long", "null"]},
                    "deadline": {"bsonType": "date"},
                    "field": {"bsonType": "string"},
                    "apply_url": {"bsonType": "string"},
                    "scraped_at": {"bsonType": "date"},
                    "created_at": {"bsonType": "date"},
                    "updated_at": {"bsonType": ["date", "null"]},
                },
            }
        },
    )

    _ensure_collection(
        "applications",
        {
            "$jsonSchema": {
                "bsonType": "object",
                "required": ["user_id", "item_id", "item_type", "status", "created_at"],
                "properties": {
                    "user_id": {"bsonType": "string"},
                    "item_id": {"bsonType": "string"},
                    "item_type": {"enum": ["scholarship", "internship", "job_posting"]},
                    "status": {"enum": ["saved", "applied", "rejected"]},
                    "notes": {"bsonType": ["string", "null"]},
                    "cv_url": {"bsonType": ["string", "null"]},
                    "applied_at": {"bsonType": ["date", "null"]},
                    "created_at": {"bsonType": "date"},
                    "updated_at": {"bsonType": ["date", "null"]},
                },
            }
        },
    )

    _ensure_collection(
        "notifications",
        {
            "$jsonSchema": {
                "bsonType": "object",
                "required": ["user_id", "type", "message", "is_read", "created_at"],
                "properties": {
                    "user_id": {"bsonType": "string"},
                    "type": {"enum": ["deadline", "new", "message"]},
                    "message": {"bsonType": "string"},
                    "ref_id": {"bsonType": ["string", "null"]},
                    "is_read": {"bsonType": "bool"},
                    "created_at": {"bsonType": "date"},
                },
            }
        },
    )

    scholarships_col.create_index([("deadline", ASCENDING)])
    scholarships_col.create_index([("type", ASCENDING), ("country", ASCENDING)])
    scholarships_col.create_index([("title", "text"), ("eligibility", "text"), ("university", "text")])
    scholarships_col.create_index([("dedupe_key", ASCENDING)], unique=True, sparse=True)

    internships_col.create_index([("deadline", ASCENDING)])
    internships_col.create_index([("location", ASCENDING), ("field", ASCENDING)])
    internships_col.create_index([("title", "text"), ("company", "text"), ("field", "text")])
    internships_col.create_index([("dedupe_key", ASCENDING)], unique=True, sparse=True)

    applications_col.create_index(
        [("user_id", ASCENDING), ("item_type", ASCENDING), ("item_id", ASCENDING)],
        unique=True,
    )
    applications_col.create_index([("user_id", ASCENDING), ("status", ASCENDING)])

    notifications_col.create_index([("user_id", ASCENDING), ("is_read", ASCENDING), ("created_at", DESCENDING)])

    users_col.create_index([("email", ASCENDING)], unique=True)
    users_col.create_index([("handle", ASCENDING)], unique=True, sparse=True)

    posts_col.create_index([("created_at", DESCENDING)])
    posts_col.create_index([("tag", ASCENDING), ("created_at", DESCENDING)])
    posts_col.create_index([("user_id", ASCENDING), ("created_at", DESCENDING)])

    messages_col.create_index([("user_id", ASCENDING), ("conversation_id", ASCENDING), ("timestamp", ASCENDING)])
    conversations_col.create_index([("user_id", ASCENDING), ("updated_at", DESCENDING)])

    dm_threads_col.create_index([("thread_id", ASCENDING)], unique=True)
    dm_threads_col.create_index([("participants", ASCENDING), ("updated_at", DESCENDING)])
    dm_messages_col.create_index([("thread_id", ASCENDING), ("created_at", ASCENDING)])

    job_postings_col.create_index([("recruiter_id", ASCENDING), ("created_at", DESCENDING)])

# ═══════════════════════════════════════════════════════
# ANTHROPIC / RAG CONFIG
# ═══════════════════════════════════════════════════════

ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY")
if not ANTHROPIC_API_KEY:
    raise ValueError("ANTHROPIC_API_KEY is missing in .env")

# FIX: Corrected model identifier
CLAUDE_MODEL = "claude-sonnet-4-5-20251001"

URLS_TO_SCRAPE: List[str] = [
    "https://scholarshiproar.com/",
    "https://www.scholarships.com/",
    "https://www.scholars4dev.com/",
    "https://opportunitiescorners.com/scholarships/",
    "https://www.scholars4dev.com/category/scholarships/",
    "https://opportunitiescorners.com/category/internships/",
    "https://hec.gov.pk/english/scholarshipsgrants/Pages/default.aspx",
]

TOP_K_CHUNKS = 5

claude_client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)
scraper       = WebScraper()
vector_store  = VectorStore()

_scheduler: BackgroundScheduler | None = None

# ═══════════════════════════════════════════════════════
# BOT PROMPTS
# ═══════════════════════════════════════════════════════

BOT_SYSTEM_PROMPTS = {
    "funded":  "You are FullFund Bot. Focus only on fully-funded scholarships covering tuition, living, flights, and insurance.",
    "merit":   "You are Merit Advisor. Focus on merit-based scholarships, required GPA, and academic excellence programs.",
    "need":    "You are Need-Based Aid advisor. Focus on financial aid, grants, FAFSA, and means-tested programs.",
    "intern":  "You are Internship Pro. Focus on internships, career advice, CVs, and connecting students with recruiters.",
    "phd":     "You are PhD Guide. Focus on doctoral programs, research funding, and supervisor relationships.",
    "general": None,
}

# ═══════════════════════════════════════════════════════
# SCHEMA FIELD WHITELISTS
# ═══════════════════════════════════════════════════════

_USER_MUTABLE_FIELDS   = {"name", "handle", "avatar", "bio", "profile", "followers", "following", "saved_posts", "updated_at"}
_USER_IMMUTABLE_FIELDS = {"email", "password", "user_type", "created_at", "_id"}
_POST_MUTABLE_FIELDS   = {"text", "tag", "updated_at"}
_POST_COUNTER_FIELDS   = {"likes", "liked_by", "saved_by", "comments"}

def _strip_immutable(doc: dict, immutable: set) -> dict:
    return {k: v for k, v in doc.items() if k not in immutable}

def _whitelist(doc: dict, allowed: set) -> dict:
    return {k: v for k, v in doc.items() if k in allowed}

# ═══════════════════════════════════════════════════════
# SCRAPE JOB
# ═══════════════════════════════════════════════════════

def run_scrape(urls: List[str] | None = None, reset: bool = False) -> Dict:
    target_urls = urls or URLS_TO_SCRAPE
    if reset:
        vector_store.clear()
    chunks = scraper.scrape_urls(target_urls)
    opp_stats = persist_opportunities_from_chunks(chunks, scholarships_col, internships_col)
    if not chunks:
        return {"chunks_added": 0, "total": vector_store.count(), **opp_stats}
    added = 0
    for chunk in chunks:
        stored = vector_store.add_chunks(
            chunks=[chunk["text"]],
            url=chunk["url"],
            metadata_extra={
                "source_domain": chunk["source_domain"],
                "scraped_at":    chunk["scraped_at"],
            },
        )
        added += stored
    return {"chunks_added": added, "total": vector_store.count(), **opp_stats}


def run_opportunity_scrape_only() -> Dict:
    """Re-crawl seed URLs and refresh scholarships/internships without touching the vector DB."""
    chunks = scraper.scrape_urls(URLS_TO_SCRAPE)
    stats = persist_opportunities_from_chunks(chunks, scholarships_col, internships_col)
    return {"mode": "opportunities_only", **stats}

def seed_dummy_content() -> None:
    if posts_col.count_documents({}) == 0:
        now = datetime.utcnow()
        posts_col.insert_many([
            {
                "user_id": "seed_user_1",
                "user_name": "Ayesha Raza",
                "user_handle": "ayesharaza",
                "user_type": "student",
                "user_avatar": "AR",
                "text": "Excited to share I received a fully-funded scholarship to study Computer Science in the UK — happy to review SOPs and share tips on interviews and application timelines.",
                "tag": "Achievement",
                "likes": 41,
                "liked_by": [],
                "comments": [{"comment_id": str(ObjectId()), "user_id": "seed_user_2", "user_name": "Hamza", "user_handle": "hamza", "user_avatar": "H", "text": "Amazing! Could you share how you structured your SOP?", "created_at": now}],
                "saved_by": [],
                "created_at": now - timedelta(hours=8),
                "updated_at": None,
            },
            {
                "user_id": "seed_user_2",
                "user_name": "Bilal Ahmed",
                "user_handle": "bilalahmed",
                "user_type": "student",
                "user_avatar": "BA",
                "text": "Tip for DAAD applicants: start language certification (TestDaF/DSH) early and factor in visa timelines — it saved me weeks of stress.",
                "tag": "Tip",
                "likes": 23,
                "liked_by": [],
                "comments": [],
                "saved_by": [],
                "created_at": now - timedelta(hours=4),
                "updated_at": None,
            },
        ])

    # Seed a test student login account for Ahmed if missing
    if not users_col.find_one({"email": "ahmed36@gmail.com"}):
        users_col.insert_one({
            "name": "Ahmed",
            "email": "ahmed36@gmail.com",
            "password": hash_password("Ahmed@123"),
            "user_type": "student",
            "status": "approved",
            "handle": "ahmed36",
            "avatar": None,
            "bio": "Student seeking scholarships and internship opportunities.",
            "profile": {
                "university": "Lahore University",
                "degree": "BSc",
                "major": "Computer Science",
                "country": "Pakistan",
                "target_country": "Germany",
                "interests": ["AI", "ML"],
                "cgpa": 3.5,
                "current_field": "Software Engineering",
                "interested_fields": ["Research", "Product"],
                "interested_countries": ["Germany", "UK"],
                "graduation_year": 2024,
                "phone": "",
                "linkedin_url": "",
                "languages": ["English", "Urdu"],
            },
            "followers": [],
            "following": [],
            "saved_posts": [],
            "created_at": datetime.utcnow(),
            "updated_at": None,
        })

    if scholarships_col.count_documents({}) == 0:
        now = datetime.utcnow()
        scholarships_col.insert_many([
            {
                "title": "Chevening Scholarship 2026",
                "type": "funded",
                "country": "United Kingdom",
                "university": "Multiple Universities",
                "amount": None,
                "deadline": now + timedelta(days=90),
                "eligibility": "Strong academic profile and leadership potential",
                "source_url": "https://www.chevening.org/",
                "apply_url": "https://www.chevening.org/apply/",
                "is_fully_funded": True,
                "scraped_at": now,
                "created_at": now,
                "updated_at": None,
            },
            {
                "title": "DAAD EPOS Scholarship",
                "type": "merit",
                "country": "Germany",
                "university": "Partner Universities",
                "amount": None,
                "deadline": now + timedelta(days=120),
                "eligibility": "Relevant bachelor degree and professional experience",
                "source_url": "https://www.daad.de/",
                "apply_url": "https://www.daad.de/en/study-and-research-in-germany/scholarships/",
                "is_fully_funded": True,
                "scraped_at": now,
                "created_at": now,
                "updated_at": None,
            },
        ])

    if internships_col.count_documents({}) == 0:
        now = datetime.utcnow()
        internships_col.insert_many([
            {
                "title": "Software Engineering Intern",
                "company": "TechBridge",
                "location": "Remote",
                "is_paid": True,
                "stipend": 60000,
                "duration_weeks": 12,
                "deadline": now + timedelta(days=45),
                "field": "Software Engineering",
                "apply_url": "https://example.com/internship/apply",
                "scraped_at": now,
                "created_at": now,
                "updated_at": None,
            }
        ])

# ═══════════════════════════════════════════════════════
# LIFESPAN
# ═══════════════════════════════════════════════════════

@asynccontextmanager
async def lifespan(app: FastAPI):
    global _scheduler
    init_database_schema()
    seed_dummy_content()
    if ENABLE_STARTUP_SCRAPE:
        if vector_store.count() == 0:
            # FIX: Use asyncio.to_thread (Python 3.9+) — non-blocking, no deprecated get_event_loop()
            asyncio.create_task(asyncio.to_thread(run_scrape))
        else:
            n_opp = scholarships_col.count_documents({}) + internships_col.count_documents({})
            if n_opp < 8:
                asyncio.create_task(asyncio.to_thread(run_opportunity_scrape_only))
    if _scheduler is None:
        _scheduler = BackgroundScheduler()
        _scheduler.add_job(
            run_scrape, CronTrigger(hour=2, minute=0),
            id="nightly_scrape", replace_existing=True,
        )
        _scheduler.add_job(
            run_opportunity_scrape_only, CronTrigger(hour=14, minute=0),
            id="midday_opportunities", replace_existing=True,
        )
        _scheduler.start()
    yield
    if _scheduler and _scheduler.running:
        _scheduler.shutdown(wait=False)

# ═══════════════════════════════════════════════════════
# APP
# ═══════════════════════════════════════════════════════

# FIX: Wildcard origin + allow_credentials=True is rejected by browsers
#      and is a security misconfiguration. Default to localhost only.
_raw_origins    = os.getenv(
    "ALLOWED_ORIGINS",
    "http://localhost:3000,http://localhost:5173,http://127.0.0.1:3000,http://127.0.0.1:5173",
)
ALLOWED_ORIGINS = [o.strip() for o in _raw_origins.split(",") if o.strip()]

app = FastAPI(title="ScholarAI API", version="5.1", lifespan=lifespan)
app.mount("/uploads", StaticFiles(directory=LOCAL_UPLOAD_DIR), name="uploads")

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ═══════════════════════════════════════════════════════
# WEBSOCKET CONNECTION MANAGER
# ═══════════════════════════════════════════════════════

class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, List[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, user_id: str):
        await websocket.accept()
        self.active_connections.setdefault(user_id, []).append(websocket)

    def disconnect(self, websocket: WebSocket, user_id: str):
        conns = self.active_connections.get(user_id, [])
        if websocket in conns:
            conns.remove(websocket)
        if not conns:
            self.active_connections.pop(user_id, None)

    async def send_to_user(self, user_id: str, message: dict):
        dead = []
        for ws in self.active_connections.get(user_id, []):
            try:
                await ws.send_json(message)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.disconnect(ws, user_id)

    def is_online(self, user_id: str) -> bool:
        return bool(self.active_connections.get(user_id))


manager = ConnectionManager()

# ═══════════════════════════════════════════════════════
# PYDANTIC MODELS
# ═══════════════════════════════════════════════════════

class ChatRequest(BaseModel):
    question: str
    conversation_history: List[dict] = []
    conversation_id: Optional[str] = None   # FIX: proper per-conversation ID
    bot_type: str = "general"

class ScrapeRequest(BaseModel):
    urls: List[str] = []
    reset: bool = False

class SignupRequest(BaseModel):
    name: str
    email: str
    password: str
    user_type: str = "student"
    university: Optional[str] = None
    degree: Optional[str] = None
    major: Optional[str] = None
    country: Optional[str] = None
    target_country: Optional[str] = None
    interests: List[str] = []
    cgpa: Optional[float] = None
    current_field: Optional[str] = None
    interested_fields: List[str] = []
    interested_countries: List[str] = []
    graduation_year: Optional[int] = None
    phone: Optional[str] = None
    linkedin_url: Optional[str] = None
    languages: List[str] = []
    # Recruiter — LinkedIn-style professional profile (merged into user.profile)
    recruiter_title: Optional[str] = None
    industry: Optional[str] = None
    company_size: Optional[str] = None
    hiring_focus: List[str] = []
    company_website: Optional[str] = None
    linkedin_company_url: Optional[str] = None
    # Recruiter business contact (prefer work email for verification)
    work_email: Optional[str] = None

class LoginRequest(BaseModel):
    email: str
    password: str




class UpdateUserRequest(BaseModel):
    name: Optional[str] = None
    bio: Optional[str] = None
    avatar: Optional[str] = None
    profile: Optional[dict] = None

class CreatePostRequest(BaseModel):
    text: Optional[str] = None
    tag: str
    image_url: Optional[str] = None
    job_posting_id: Optional[str] = None

class JobPostingCreate(BaseModel):
    title: str
    description: str
    employment_type: str = "Internship"
    location_type: str = "Hybrid"
    location: Optional[str] = None
    apply_how: str
    field: Optional[str] = None
    skills_keywords: List[str] = []
    required_keywords: List[str] = []
    preferred_keywords: List[str] = []
    minimum_cv_score: Optional[int] = 45
    auto_hide_irrelevant_cvs: bool = True
    deadline: Optional[datetime] = None

class CommentRequest(BaseModel):
    text: str

class DMThreadRequest(BaseModel):
    recipient_id: str

class DMMessageRequest(BaseModel):
    text: str

class ScholarshipRequest(BaseModel):
    title: str
    type: str
    country: str
    university: Optional[str] = None
    amount: Optional[float] = None
    deadline: datetime
    eligibility: str
    source_url: Optional[str] = None
    apply_url: str
    is_fully_funded: bool = False
    scraped_at: Optional[datetime] = None

class InternshipRequest(BaseModel):
    title: str
    company: str
    location: str
    is_paid: bool = False
    stipend: Optional[float] = None
    duration_weeks: Optional[int] = None
    deadline: datetime
    field: str
    apply_url: str
    scraped_at: Optional[datetime] = None

class ApplicationRequest(BaseModel):
    item_id: str
    item_type: str
    status: str = "saved"
    notes: Optional[str] = None
    cv_url: Optional[str] = None

class ApplicationReviewRequest(BaseModel):
    review_status: str

class NotificationRequest(BaseModel):
    type: str
    message: str
    ref_id: Optional[str] = None

# ═══════════════════════════════════════════════════════
# HELPERS
# ═══════════════════════════════════════════════════════

def _serialize(doc: dict) -> dict:
    """
    Recursively convert ObjectIds and datetimes to JSON-safe strings.
    FIX: Iterates over list(doc.items()) to avoid mutating dict during iteration.
    FIX: Also handles datetime objects (previously silently broke JSON encoding).
    """
    if doc is None:
        return None
    for k, v in list(doc.items()):   # FIX: list() prevents mutation-during-iteration
        if isinstance(v, ObjectId):
            doc[k] = str(v)
        elif isinstance(v, datetime):   # FIX: serialize datetimes
            doc[k] = v.isoformat()
        elif isinstance(v, list):
            doc[k] = [
                _serialize(i) if isinstance(i, dict)
                else str(i) if isinstance(i, ObjectId)
                else i.isoformat() if isinstance(i, datetime)
                else i
                for i in v
            ]
        elif isinstance(v, dict):
            doc[k] = _serialize(v)
    return doc

def _get_thread_id(uid1: str, uid2: str) -> str:
    return "_".join(sorted([uid1, uid2]))

def _parse_object_id(value: str, field_name: str = "id") -> ObjectId:
    try:
        return ObjectId(value)
    except Exception:
        raise HTTPException(400, f"Invalid {field_name}")

def _build_system_prompt(contexts: List[dict]) -> str:
    blocks = [
        f"[Source {i} | {c['url']} | score {c['score']}]\n{c['text']}"
        for i, c in enumerate(contexts, 1)
    ]
    return (
        "You are a helpful scholarship research assistant.\n"
        "Answer ONLY from the context below.\n\n"
        "CONTEXT:\n" + "\n\n---\n\n".join(blocks) + "\n\n"
        "RULES:\n"
        "- Be concise and direct.\n"
        "- If the answer is not in the context, say: \"I couldn't find that in the scraped content.\"\n"
        "- Do NOT make up facts.\n"
        "- Mention source URLs.\n"
    )


def _build_general_assistant_system(bot_type: str) -> str:
    base = (
        "You are SCHLR AI — a concise, professional advisor for scholarships, internships, CVs, and study preparation.\n"
        "No SCHLR knowledge-base snippets matched this question.\n"
        "Give generally sound guidance; do not invent specific program names, deadlines, acceptance rates, fees, or URLs.\n"
        "If facts are uncertain, say so and suggest checking official sources (universities, HEC, IBCC, MOFA, embassies).\n"
        "Use brief headings and bullets when helpful.\n"
    )
    prefix = BOT_SYSTEM_PROMPTS.get(bot_type)
    if prefix:
        return prefix + "\n\n" + base
    return base


def _generate_answer(
    question: str, history: List[dict], contexts: List[dict], bot_type: str = "general"
) -> str:
    messages = [{"role": h["role"], "content": h["content"]} for h in history]
    messages.append({"role": "user", "content": question})
    if contexts:
        system = _build_system_prompt(contexts)
        bot_prefix = BOT_SYSTEM_PROMPTS.get(bot_type)
        if bot_prefix:
            system = bot_prefix + "\n\n" + system
    else:
        system = _build_general_assistant_system(bot_type)
    response = claude_client.messages.create(
        model=CLAUDE_MODEL, max_tokens=1024, system=system, messages=messages,
    )
    return response.content[0].text.strip()

# ═══════════════════════════════════════════════════════
# CORE ROUTES
# ═══════════════════════════════════════════════════════

@app.get("/")
def root():
    return {"status": "running", "chunks_in_db": vector_store.count(), "model": CLAUDE_MODEL}

@app.get("/status")
def get_status():
    return {
        "chunks": vector_store.count(),
        "urls":   URLS_TO_SCRAPE,
        "incremental_state": scraper.incremental_status(),
        "scholarships_in_db": r_scholarships_col.count_documents({}),
        "internships_in_db": r_internships_col.count_documents({}),
    }

@app.get("/health")
def health():
    return {
        "status": "ok",
        "mongo": True,
        "vector_chunks": vector_store.count(),
        "scholarships": r_scholarships_col.count_documents({}),
        "internships": r_internships_col.count_documents({}),
    }

@app.post("/scrape")
def manual_scrape(payload: ScrapeRequest, current_user: dict = Depends(get_current_user)):
    # FIX: SSRF guard — validate all user-supplied URLs before passing to scraper
    urls = validate_scrape_urls(payload.urls or URLS_TO_SCRAPE)
    return run_scrape(urls=urls, reset=payload.reset)

@app.post("/scrape/opportunities")
def manual_opportunity_scrape(current_user: dict = Depends(get_current_user)):
    return run_opportunity_scrape_only()

# ═══════════════════════════════════════════════════════
# CHAT (RAG)
# ═══════════════════════════════════════════════════════

@app.post("/chat")
def chat(payload: ChatRequest, current_user: dict = Depends(get_current_user)):
    question = payload.question.strip()
    if not question:
        raise HTTPException(400, "Question must not be empty")

    history = payload.conversation_history or []
    try:
        contexts = vector_store.query(question, top_k=TOP_K_CHUNKS)
    except Exception:
        contexts = []

    sources = list(dict.fromkeys(c["url"] for c in contexts))
    user_id = current_user["sub"]
    conversation_id = payload.conversation_id or user_id
    warning: Optional[str] = None

    try:
        answer = _generate_answer(question, history, contexts, payload.bot_type)
    except anthropic.APIError:
        answer = (
            "The AI assistant cannot reach Claude right now. Please try again shortly. "
            "If your project uses ANTHROPIC_API_KEY in `backend/.env`, confirm it is active and billed."
        )
        sources = []
        warning = "ai_upstream"

    try:
        messages_col.insert_many(
            [
                {
                    "user_id": user_id,
                    "conversation_id": conversation_id,
                    "role": "user",
                    "content": question,
                    "timestamp": datetime.utcnow(),
                },
                {
                    "user_id": user_id,
                    "conversation_id": conversation_id,
                    "role": "assistant",
                    "content": answer,
                    "sources": sources,
                    "timestamp": datetime.utcnow(),
                },
            ]
        )
    except Exception:
        pass

    out: Dict = {"answer": answer, "sources": sources, "bot_type": payload.bot_type}
    if warning:
        out["warning"] = warning
    return out

@app.get("/chat/history")
def chat_history(current_user: dict = Depends(get_current_user)):
    user_id = current_user["sub"]
    msgs = list(r_messages_col.find({"user_id": user_id}).sort("timestamp", 1))
    for m in msgs:
        m["_id"] = str(m["_id"])
    return msgs

# ═══════════════════════════════════════════════════════
# NEWS
# ═══════════════════════════════════════════════════════

@app.get("/news")
def get_news(limit: int = 20):
    results = vector_store.query("scholarship internship deadline grant", top_k=limit)
    news = [
        {
            "id":         i + 1,
            "title":      r["text"].split("\n")[0][:100],
            "snippet":    r["text"][:200].replace("\n", " "),
            "url":        r["url"],
            "site":       r.get("source_domain", ""),
            "scraped_at": r.get("scraped_at", ""),
            "score":      r.get("score", 0),
        }
        for i, r in enumerate(results)
    ]
    return {"news": news, "total": len(news)}


@app.get("/guides/degree-attestation")
def get_degree_attestation_guide():
    return degree_attestation_guide()


@app.get("/recommendations/matches")
def recommendations_matches(limit: int = 8, current_user: dict = Depends(get_current_user)):
    user = r_users_col.find_one({"_id": ObjectId(current_user["sub"])})
    if not user:
        raise HTTPException(404, "User not found")
    profile = user.get("profile") or {}
    now = datetime.utcnow()
    scholarships = list(
        r_scholarships_col.find({"deadline": {"$gte": now}}).sort("deadline", 1).limit(80)
    )
    internships = list(
        r_internships_col.find({"deadline": {"$gte": now}}).sort("deadline", 1).limit(80)
    )
    ranked_s = sorted(
        scholarships,
        key=lambda d: _score_doc_for_profile(d, profile, "scholarship"),
        reverse=True,
    )[: max(1, min(limit, 24))]
    ranked_i = sorted(
        internships,
        key=lambda d: _score_doc_for_profile(d, profile, "internship"),
        reverse=True,
    )[: max(1, min(limit, 24))]
    for lst in (ranked_s, ranked_i):
        for d in lst:
            d["_id"] = str(d["_id"])
            _serialize(d)
    return {
        "profile_summary": {
            "major": profile.get("major"),
            "target_country": profile.get("target_country"),
            "interests": profile.get("interests"),
            "degree": profile.get("degree"),
        },
        "scholarships": ranked_s,
        "internships": ranked_i,
    }


@app.post("/upload/image")
async def upload_image(
    file: UploadFile = File(...),
    folder: str = Query("posts", description="posts or avatars"),
    current_user: dict = Depends(get_current_user),
):
    vf = folder if folder in ("posts", "avatars") else "posts"
    content = await file.read()
    if len(content) > 8 * 1024 * 1024:
        raise HTTPException(400, "File too large (max 8 MB)")
    ctype = (file.content_type or "").lower()
    allowed_types = {
        "image/jpeg": ".jpg",
        "image/png": ".png",
        "image/webp": ".webp",
        "image/gif": ".gif",
    }
    if ctype not in allowed_types:
        raise HTTPException(400, "Only JPEG, PNG, WebP, or GIF images are allowed")

    if CLOUDINARY_CONFIGURED:
        try:
            url = upload_to_cloudinary(content, folder=f"schlr/{vf}")
            return {"url": url, "storage": "cloudinary"}
        except Exception as e:
            raise HTTPException(500, f"Upload failed: {str(e)}")

    # Fallback for local/dev use when Cloudinary is not configured.
    ext = allowed_types[ctype]
    safe_folder = os.path.join(LOCAL_UPLOAD_DIR, vf)
    os.makedirs(safe_folder, exist_ok=True)
    filename = f"{uuid.uuid4().hex}{ext}"
    abs_path = os.path.join(safe_folder, filename)
    with open(abs_path, "wb") as f:
        f.write(content)
    url = f"{PUBLIC_BACKEND_URL}/uploads/{vf}/{filename}"
    return {"url": url, "storage": "local"}


@app.post("/upload/document")
async def upload_document(
    file: UploadFile = File(...),
    folder: str = Query("cvs", description="cvs — résumés / PDFs"),
    current_user: dict = Depends(get_current_user),
):
    """Upload a PDF résumé/CV (student applications). Stored under uploads/cvs or Cloudinary raw."""
    vf = folder if folder in ("cvs",) else "cvs"
    content = await file.read()
    if len(content) > 5 * 1024 * 1024:
        raise HTTPException(400, "File too large (max 5 MB)")
    ctype = (file.content_type or "").lower()
    fname = (file.filename or "").lower()
    if ctype not in ("application/pdf", "application/x-pdf") and not fname.endswith(".pdf"):
        raise HTTPException(400, "Only PDF documents are allowed for CV upload")

    if CLOUDINARY_CONFIGURED:
        import cloudinary.uploader

        result = cloudinary.uploader.upload(
            content,
            folder=f"schlr/{vf}",
            resource_type="raw",
        )
        url = result.get("secure_url") or result.get("url")
        if not url:
            raise HTTPException(500, "Upload failed")
        return {"url": url, "storage": "cloudinary"}

    safe_folder = os.path.join(LOCAL_UPLOAD_DIR, vf)
    os.makedirs(safe_folder, exist_ok=True)
    filename = f"{uuid.uuid4().hex}.pdf"
    abs_path = os.path.join(safe_folder, filename)
    with open(abs_path, "wb") as f:
        f.write(content)
    url = f"{PUBLIC_BACKEND_URL}/uploads/{vf}/{filename}"
    return {"url": url, "storage": "local"}


@app.get("/users/search")
def search_users(
    q: str = "",
    limit: int = 12,
    current_user: dict = Depends(get_current_user),
):
    """Find users by name or handle to start a DM thread (directory search)."""
    needle = (q or "").strip()
    if len(needle) < 2:
        return {"users": []}
    lim = max(1, min(limit, 30))
    me = current_user["sub"]
    rx = re.compile(re.escape(needle), re.I)
    cur = r_users_col.find(
        {"_id": {"$ne": ObjectId(me)}, "$or": [{"handle": rx}, {"name": rx}]},
        {"password": 0, "name": 1, "handle": 1, "user_type": 1, "avatar": 1},
    ).limit(lim)
    users_out: List[dict] = []
    for u in cur:
        users_out.append(
            {
                "id": str(u["_id"]),
                "name": u.get("name"),
                "handle": u.get("handle"),
                "user_type": u.get("user_type"),
                "avatar": u.get("avatar"),
            }
        )
    return {"users": users_out}


@app.post("/recruiter/jobs", status_code=201)
def recruiter_create_job(data: JobPostingCreate, current_user: dict = Depends(get_current_user)):
    uid = current_user["sub"]
    u = r_users_col.find_one({"_id": ObjectId(uid)})
    if not u or u.get("user_type") != "recruiter" or u.get("status") != "approved":
        raise HTTPException(403, "Only approved recruiter accounts can publish roles")
    if not data.title.strip():
        raise HTTPException(400, "Job title is required")
    if len((data.description or "").strip()) < 20:
        raise HTTPException(400, "Description should be at least 20 characters")
    prof = u.get("profile") or {}
    doc = {
        "recruiter_id": uid,
        "company_name": prof.get("university") or u.get("name"),
        "title": data.title.strip(),
        "description": data.description.strip(),
        "employment_type": data.employment_type.strip() or "Internship",
        "location_type": data.location_type.strip() or "Hybrid",
        "location": (data.location or "").strip() or None,
        "apply_how": data.apply_how.strip(),
        "field": (data.field or "").strip() or None,
        "skills_keywords": data.skills_keywords or [],
        "required_keywords": data.required_keywords or [],
        "preferred_keywords": data.preferred_keywords or [],
        "minimum_cv_score": data.minimum_cv_score if data.minimum_cv_score is not None else 45,
        "auto_hide_irrelevant_cvs": data.auto_hide_irrelevant_cvs,
        "deadline": data.deadline,
        "created_at": datetime.utcnow(),
        "updated_at": None,
        "status": "active",
    }
    result = job_postings_col.insert_one(doc)
    return {"status": "created", "job_id": str(result.inserted_id)}


@app.get("/recruiter/jobs/me")
def recruiter_list_jobs(current_user: dict = Depends(get_current_user)):
    uid = current_user["sub"]
    u = r_users_col.find_one({"_id": ObjectId(uid)})
    if not u or u.get("user_type") != "recruiter" or u.get("status") != "approved":
        raise HTTPException(403, "Approved recruiter accounts only")
    jobs = list(r_job_postings_col.find({"recruiter_id": uid}).sort("created_at", -1))
    for j in jobs:
        jid = str(j["_id"])
        j["_id"] = jid
        j["application_count"] = applications_col.count_documents(
            {"item_type": "job_posting", "item_id": jid}
        )
        _serialize(j)
    return {"jobs": jobs}


@app.delete("/recruiter/jobs/{job_id}")
def recruiter_delete_job(job_id: str, current_user: dict = Depends(get_current_user)):
    uid = current_user["sub"]
    oid = _parse_object_id(job_id, "job_id")
    doc = job_postings_col.find_one({"_id": oid})
    if not doc or doc.get("recruiter_id") != uid:
        raise HTTPException(404, "Job not found")
    job_postings_col.delete_one({"_id": oid})
    return {"status": "deleted"}


@app.get("/jobs/public")
def list_public_jobs(
    page: int = 1,
    limit: int = 20,
):
    """Active job/internship postings from recruiters (browse & apply)."""
    lim = max(1, min(limit, 50))
    skip = (max(1, page) - 1) * lim
    q = {"status": "active"}
    docs = list(r_job_postings_col.find(q).sort("created_at", DESCENDING).skip(skip).limit(lim))
    total = r_job_postings_col.count_documents(q)
    for d in docs:
        d["_id"] = str(d["_id"])
        _serialize(d)
    return {"items": docs, "total": total, "page": page, "limit": lim}


@app.post("/jobs/{job_id}/apply-with-cv", status_code=201)
async def apply_to_job_with_cv(
    job_id: str,
    file: UploadFile = File(...),
    notes: Optional[str] = Form(None),
    current_user: dict = Depends(get_current_user),
):
    if not file.filename:
        raise HTTPException(400, "A CV file is required")
    if file.content_type:
        content_type = file.content_type.lower()
    else:
        content_type = None

    if current_user is None:
        raise HTTPException(401, "Unauthorized")

    applicant = r_users_col.find_one({"_id": ObjectId(current_user["sub"])})
    if not applicant or applicant.get("user_type") != "student":
        raise HTTPException(403, "Only student accounts can apply to recruiter job postings")

    oid = _parse_object_id(job_id, "job_id")
    job = r_job_postings_col.find_one({"_id": oid})
    if not job:
        raise HTTPException(404, "Job posting not found")
    if job.get("status") != "active":
        raise HTTPException(400, "This posting is no longer accepting applications")
    if job.get("recruiter_id") == current_user["sub"]:
        raise HTTPException(400, "You cannot apply to your own job posting")

    existing = applications_col.find_one({"user_id": current_user["sub"], "item_id": job_id, "item_type": "job_posting"})
    if existing:
        raise HTTPException(409, "Application already exists for this job")

    content = await file.read()
    if len(content) > 8 * 1024 * 1024:
        raise HTTPException(400, "File too large (max 8 MB)")

    filename = os.path.basename(file.filename or "cv")
    ext = os.path.splitext(filename)[1].lower()
    allowed_ext = {".pdf", ".docx", ".txt", ".jpg", ".jpeg", ".png", ".webp"}
    if ext not in allowed_ext:
        raise HTTPException(400, "Unsupported CV file format")

    safe_folder = os.path.join(LOCAL_UPLOAD_DIR, "cvs")
    os.makedirs(safe_folder, exist_ok=True)
    stored_filename = f"{uuid.uuid4().hex}{ext}"
    abs_path = os.path.join(safe_folder, stored_filename)
    with open(abs_path, "wb") as f:
        f.write(content)

    try:
        extracted_text = extract_text_from_cv(abs_path, filename, content_type)
    except Exception as exc:
        raise HTTPException(400, f"CV extraction failed: {exc}")

    analysis = analyze_cv_against_job(extracted_text, job)
    minimum_score = job.get("minimum_cv_score") if isinstance(job.get("minimum_cv_score"), int) else 45
    show_to_recruiter = analysis.get("show_to_recruiter", True)
    if job.get("auto_hide_irrelevant_cvs", True) and analysis.get("score", 0) < minimum_score:
        show_to_recruiter = False

    review_status = "auto_shortlisted"
    if analysis["status"] == "Needs Manual Review":
        review_status = "needs_review"
    elif analysis["status"] == "Irrelevant or Unusual CV":
        review_status = "auto_hidden"

    doc = {
        "user_id": current_user["sub"],
        "item_id": job_id,
        "item_type": "job_posting",
        "status": "applied",
        "notes": notes,
        "cv_url": f"{PUBLIC_BACKEND_URL}/uploads/cvs/{stored_filename}",
        "cv_original_filename": filename,
        "cv_file_type": content_type or ext,
        "cv_extracted_text": extracted_text,
        "cv_text_preview": extracted_text[:500],
        "cv_analysis": analysis,
        "cv_score": analysis.get("score", 0),
        "cv_match_status": analysis.get("status", ""),
        "show_to_recruiter": show_to_recruiter,
        "review_status": review_status,
        "applied_at": datetime.utcnow(),
        "created_at": datetime.utcnow(),
        "updated_at": None,
    }
    try:
        result = applications_col.insert_one(doc)
    except Exception:
        raise HTTPException(409, "Application already exists for this job")

    return {
        "status": "created",
        "id": str(result.inserted_id),
        "cv_analysis": analysis,
    }


@app.get("/recruiter/jobs/{job_id}/applications")
def recruiter_list_job_applications(
    job_id: str,
    min_score: Optional[int] = None,
    match_status: Optional[str] = None,
    show_hidden: bool = False,
    review_status: Optional[str] = None,
    current_user: dict = Depends(get_current_user),
):
    uid = current_user["sub"]
    u = r_users_col.find_one({"_id": ObjectId(uid)})
    if not u or u.get("user_type") != "recruiter" or u.get("status") != "approved":
        raise HTTPException(403, "Approved recruiter accounts only")
    oid = _parse_object_id(job_id, "job_id")
    job = r_job_postings_col.find_one({"_id": oid})
    if not job or job.get("recruiter_id") != uid:
        raise HTTPException(404, "Job not found")

    query = {"item_id": job_id, "item_type": "job_posting"}
    if min_score is not None:
        query["cv_score"] = {"$gte": min_score}
    if match_status:
        query["cv_match_status"] = match_status
    if review_status:
        query["review_status"] = review_status
    if not show_hidden:
        query["show_to_recruiter"] = True

    apps = list(r_applications_col.find(query).sort([("cv_score", DESCENDING), ("created_at", DESCENDING)]))
    out: List[dict] = []
    for a in apps:
        a["_id"] = str(a["_id"])
        _serialize(a)
        applicant = r_users_col.find_one(
            {"_id": ObjectId(a["user_id"])},
            {"password": 0, "name": 1, "email": 1, "handle": 1, "avatar": 1, "profile": 1, "user_type": 1},
        )
        if applicant:
            applicant["_id"] = str(applicant["_id"])
        out.append({**a, "applicant": applicant})
    return {"applications": out}


@app.put("/recruiter/applications/{application_id}/review")
def recruiter_review_application(
    application_id: str,
    data: ApplicationReviewRequest,
    current_user: dict = Depends(get_current_user),
):
    uid = current_user["sub"]
    u = r_users_col.find_one({"_id": ObjectId(uid)})
    if not u or u.get("user_type") != "recruiter" or u.get("status") != "approved":
        raise HTTPException(403, "Approved recruiter accounts only")

    oid = _parse_object_id(application_id, "application_id")
    application = r_applications_col.find_one({"_id": oid})
    if not application:
        raise HTTPException(404, "Application not found")
    if application.get("item_type") != "job_posting":
        raise HTTPException(400, "Only recruiter job applications can be reviewed")

    job = r_job_postings_col.find_one({"_id": _parse_object_id(application["item_id"], "item_id")})
    if not job or job.get("recruiter_id") != uid:
        raise HTTPException(404, "Application not found")

    allowed_statuses = {"manual_shortlisted", "manual_rejected", "needs_review"}
    if data.review_status not in allowed_statuses:
        raise HTTPException(400, f"Invalid review_status. Allowed: {sorted(allowed_statuses)}")

    show_to_recruiter = data.review_status != "manual_rejected"

    update_doc = {
        "review_status": data.review_status,
        "show_to_recruiter": show_to_recruiter,
        "updated_at": datetime.utcnow(),
    }
    r_applications_col.update_one({"_id": oid}, {"$set": update_doc})
    return {"status": "updated"}


@app.get("/recruiter/dashboard")
def recruiter_dashboard(current_user: dict = Depends(get_current_user)):
    uid = current_user["sub"]
    u = r_users_col.find_one({"_id": ObjectId(uid)})
    if not u or u.get("user_type") != "recruiter" or u.get("status") != "approved":
        raise HTTPException(403, "Approved recruiter accounts only")
    prof = u.get("profile") or {}
    active_jobs = job_postings_col.count_documents({"recruiter_id": uid})
    week_ago = datetime.utcnow() - timedelta(days=7)
    job_ids: List[str] = [
        str(x["_id"]) for x in job_postings_col.find({"recruiter_id": uid}, {"_id": 1})
    ]
    new_applicants_this_week = 0
    total_applicants = 0
    if job_ids:
        total_applicants = applications_col.count_documents(
            {"item_type": "job_posting", "item_id": {"$in": job_ids}}
        )
        new_applicants_this_week = applications_col.count_documents(
            {
                "item_type": "job_posting",
                "item_id": {"$in": job_ids},
                "created_at": {"$gte": week_ago},
            }
        )
    return {
        "company": {
            "display_name": prof.get("university") or u.get("name"),
            "industry": prof.get("industry"),
            "recruiter_title": prof.get("recruiter_title"),
            "company_website": prof.get("company_website"),
            "linkedin_company_url": prof.get("linkedin_company_url"),
            "hiring_focus": prof.get("hiring_focus") or [],
        },
        "metrics": {
            "active_job_postings": active_jobs,
            "new_applicants_this_week": new_applicants_this_week,
            "total_applicants": total_applicants,
            "shortlisted": 0,
            "in_interview": 0,
        },
        "tips": [
            "Clear titles and required skills improve match quality with STEM and business talent.",
            "Review CVs submitted through SCHLR under each job posting.",
            "Share application links or a monitored careers inbox in “How to apply”.",
        ],
    }

# ═══════════════════════════════════════════════════════
# AUTH
# ═══════════════════════════════════════════════════════

@app.post("/auth/signup", status_code=201)
def signup(data: SignupRequest):
    email = data.email.strip().lower()
    if not _is_valid_email(email):
        raise HTTPException(400, "Please enter a valid email address")
    if not data.name or len(data.name.strip()) < 3:
        raise HTTPException(400, "Name must be at least 3 characters long")
    if not _is_strong_password(data.password):
        raise HTTPException(
            400,
            "Password must be at least 8 characters and include uppercase, lowercase, number, and special character",
        )
    if r_users_col.find_one({"email": email}):
        raise HTTPException(400, "Email already registered")

    ut = data.user_type if data.user_type in ("student", "recruiter", "super_admin") else "student"
    if ut == "recruiter":
        title = (data.recruiter_title or "").strip()
        industry = (data.industry or "").strip()
        if len(title) < 2:
            raise HTTPException(400, "Your role or title at the organization is required for recruiter accounts")
        if len(industry) < 2:
            raise HTTPException(400, "Industry is required for recruiter accounts")
        # Enforce work email for recruiter signups
        work_email = (data.work_email or "").strip().lower()
        if not _is_valid_email(work_email):
            raise HTTPException(400, "Recruiter accounts require a valid work email")
        # Reject common free-email providers for recruiter accounts
        if _is_free_email_provider(work_email):
            raise HTTPException(400, "Please sign up with a corporate / work email address")

    profile: dict = {
        "university": data.university,
        "degree": data.degree,
        "major": data.major,
        "country": data.country,
        "target_country": data.target_country,
        "interests": data.interests,
        "cgpa": data.cgpa,
        "current_field": data.current_field,
        "interested_fields": data.interested_fields,
        "interested_countries": data.interested_countries,
        "graduation_year": data.graduation_year,
        "phone": data.phone,
        "linkedin_url": data.linkedin_url,
        "languages": data.languages,
    }
    if ut == "recruiter":
        profile.update(
            {
                "recruiter_title": (data.recruiter_title or "").strip(),
                "industry": (data.industry or "").strip(),
                "company_size": (data.company_size or "").strip() or None,
                "hiring_focus": data.hiring_focus or [],
                "company_website": (data.company_website or "").strip() or None,
                "linkedin_company_url": (data.linkedin_company_url or "").strip() or None,
                "work_email": (data.work_email or email).strip().lower(),
                "is_verified": False,
            }
        )

    user = {
        "name": data.name,
        "email": email,
        "password": hash_password(data.password),
        "user_type": ut,
        "status": "pending" if ut == "recruiter" else "approved",
        "handle": email.split("@")[0],
        "avatar": None,
        "bio": None,
        "profile": profile,
        "followers": [],
        "following": [],
        "saved_posts": [],
        "created_at": datetime.utcnow(),
        "updated_at": None,
    }

    result  = users_col.insert_one(user)
    user_id = str(result.inserted_id)
    token   = create_access_token(user_id, email)

    return {
        "status": "created",
        "token":  token,
        "user": {
            "id":        user_id,
            "name":      data.name,
            "email":     email,
            "user_type": user["user_type"],
            "handle":    user["handle"],
            "profile":   user["profile"],
        },
    }


@app.post("/auth/login")
def login(data: LoginRequest):
    email = data.email.strip().lower()
    if not _is_valid_email(email):
        raise HTTPException(400, "Please enter a valid email address")
    if not data.password or len(data.password) < 8:
        raise HTTPException(400, "Invalid email or password")


    if email == ADMIN_EMAIL and data.password == ADMIN_PASSWORD:
        user = get_super_admin_user()
    else:
        user = r_users_col.find_one({"email": email})
        if not user or not verify_password(data.password, user["password"]):
            raise HTTPException(401, "Invalid email or password")

    if user.get("user_type") == "recruiter" and user.get("status") == "pending":
        raise HTTPException(403, "Account pending approval from super admin")
    elif user.get("user_type") == "recruiter" and user.get("status") == "rejected":
        raise HTTPException(403, "Account rejected by super admin")

    if user.get("_id") != SUPER_ADMIN_ID:
        users_col.update_one(
            {"_id": user["_id"]},
            {"$set": {"updated_at": datetime.utcnow(), "last_login_at": datetime.utcnow()}},
        )

    user_id = str(user["_id"])
    token   = create_access_token(user_id, user["email"])

    return {
        "status": "success",
        "token":  token,
        "user": {
            "id":        user_id,
            "name":      user["name"],
            "email":     user["email"],
            "user_type": user["user_type"],
            "handle":    user.get("handle", ""),
            "avatar":    user.get("avatar"),
            "bio":       user.get("bio"),
            "profile":   user.get("profile", {}),
            "followers": user.get("followers", []),
            "following": user.get("following", []),
        },
    }


@app.get("/auth/me")
def me(current_user: dict = Depends(get_current_user)):
    user = get_user_by_token(current_user)
    if not user:
        raise HTTPException(404, "User not found")
    if user.get("_id") != SUPER_ADMIN_ID:
        user["_id"] = str(user["_id"])
        user.pop("password", None)
    return user

# ═══════════════════════════════════════════════════════
# SUPER ADMIN (RECRUITER VERIFICATION)
# ═══════════════════════════════════════════════════════

@app.get("/admin/recruiters/pending")
def admin_get_pending_recruiters(current_user: dict = Depends(get_current_user)):
    user = get_user_by_token(current_user)
    if not user or user.get("user_type") != "super_admin":
        raise HTTPException(403, "Super admin access required")
    recruiters = list(r_users_col.find({"user_type": "recruiter", "status": "pending"}, {"password": 0}).sort("created_at", -1))
    for r in recruiters:
        r["_id"] = str(r["_id"])
    return {"recruiters": recruiters}


@app.get("/admin/recruiters/approved")
def admin_get_approved_recruiters(current_user: dict = Depends(get_current_user)):
    user = get_user_by_token(current_user)
    if not user or user.get("user_type") != "super_admin":
        raise HTTPException(403, "Super admin access required")
    recruiters = list(r_users_col.find({"user_type": "recruiter", "status": "approved"}, {"password": 0}).sort("created_at", -1))
    for r in recruiters:
        r["_id"] = str(r["_id"])
    return {"recruiters": recruiters}


@app.get("/admin/recruiters/all")
def admin_get_all_recruiters(current_user: dict = Depends(get_current_user)):
    user = get_user_by_token(current_user)
    if not user or user.get("user_type") != "super_admin":
        raise HTTPException(403, "Super admin access required")
    recruiters = list(r_users_col.find({"user_type": "recruiter"}, {"password": 0}).sort("created_at", -1))
    for r in recruiters:
        r["_id"] = str(r["_id"])
    return {"recruiters": recruiters}


@app.post("/admin/recruiters/{recruiter_id}/approve")
def admin_approve_recruiter(recruiter_id: str, current_user: dict = Depends(get_current_user)):
    user = get_user_by_token(current_user)
    if not user or user.get("user_type") != "super_admin":
        raise HTTPException(403, "Super admin access required")
    
    result = users_col.update_one(
        {"_id": ObjectId(recruiter_id), "user_type": "recruiter"},
        {"$set": {"status": "approved", "updated_at": datetime.utcnow(), "profile.is_verified": True, "profile.verified_at": datetime.utcnow(), "profile.verified_by": SUPER_ADMIN_ID}}
    )
    if result.matched_count == 0:
        raise HTTPException(404, "Recruiter not found")
    return {"status": "approved"}


@app.post("/admin/recruiters/{recruiter_id}/reject")
def admin_reject_recruiter(recruiter_id: str, current_user: dict = Depends(get_current_user)):
    user = get_user_by_token(current_user)
    if not user or user.get("user_type") != "super_admin":
        raise HTTPException(403, "Super admin access required")
    
    result = users_col.update_one(
        {"_id": ObjectId(recruiter_id), "user_type": "recruiter"},
        {"$set": {"status": "rejected", "updated_at": datetime.utcnow(), "profile.is_verified": False}}
    )
    if result.matched_count == 0:
        raise HTTPException(404, "Recruiter not found")
    return {"status": "rejected"}


@app.get("/admin/stats")
def admin_get_stats(current_user: dict = Depends(get_current_user)):
    user = get_user_by_token(current_user)
    if not user or user.get("user_type") != "super_admin":
        raise HTTPException(403, "Super admin access required")
    
    total_users = r_users_col.count_documents({})
    total_recruiters = r_users_col.count_documents({"user_type": "recruiter"})
    pending_recruiters = r_users_col.count_documents({"user_type": "recruiter", "status": "pending"})
    approved_recruiters = r_users_col.count_documents({"user_type": "recruiter", "status": "approved"})
    total_students = r_users_col.count_documents({"user_type": "student"})
    
    return {
        "total_users": total_users,
        "total_recruiters": total_recruiters,
        "pending_recruiters": pending_recruiters,
        "approved_recruiters": approved_recruiters,
        "total_students": total_students,
    }


# ═══════════════════════════════════════════════════════
# USERS
# ═══════════════════════════════════════════════════════

@app.get("/users/{user_id}")
def get_user(user_id: str):
    user = r_users_col.find_one({"_id": ObjectId(user_id)})
    if not user:
        raise HTTPException(404, "User not found")
    user["_id"] = str(user["_id"])
    user.pop("password", None)
    return user


@app.put("/users/{user_id}")
def update_user(
    user_id: str,
    data: UpdateUserRequest,
    current_user: dict = Depends(get_current_user),
):
    if current_user["sub"] != user_id:
        raise HTTPException(403, "Cannot update another user's profile")

    raw_update: dict = {"updated_at": datetime.utcnow()}
    if data.name is not None:
        raw_update["name"] = data.name
    if data.bio is not None:
        raw_update["bio"] = (data.bio or "")[:4000]
    if data.avatar is not None:
        av = (data.avatar or "").strip()
        if av.startswith("http") and CLOUDINARY_CONFIGURED and not _allowed_image_url(av):
            raise HTTPException(400, "Profile photo must use an image uploaded through SCHLR")
        raw_update["avatar"] = av or None
    if data.profile is not None:
        allowed_profile_keys = {
            "university",
            "degree",
            "major",
            "country",
            "target_country",
            "interests",
            "cgpa",
            "current_field",
            "interested_fields",
            "interested_countries",
            "graduation_year",
            "phone",
            "linkedin_url",
            "github_url",
            "website_url",
            "skills",
            "languages",
            "recruiter_title",
            "industry",
            "company_size",
            "hiring_focus",
            "company_website",
            "linkedin_company_url",
            "cv_url",
            "work_email",
        }
        existing = users_col.find_one({"_id": ObjectId(user_id)}, {"profile": 1}) or {}
        current_profile = existing.get("profile") or {}
        filtered = {k: v for k, v in data.profile.items() if k in allowed_profile_keys}
        raw_update["profile"] = {**current_profile, **filtered}

    safe_update = _strip_immutable(raw_update, _USER_IMMUTABLE_FIELDS)
    users_col.update_one({"_id": ObjectId(user_id)}, {"$set": safe_update})
    return {"status": "updated"}


@app.delete("/users/{user_id}")
def delete_user(user_id: str, current_user: dict = Depends(get_current_user)):
    if current_user["sub"] != user_id:
        raise HTTPException(403, "Cannot delete another user's account")

    # FIX: Cascade delete to prevent orphaned documents
    posts_col.delete_many({"user_id": user_id})
    job_postings_col.delete_many({"recruiter_id": user_id})
    messages_col.delete_many({"user_id": user_id})
    dm_messages_col.delete_many({"sender_id": user_id})
    dm_threads_col.delete_many({"participants": user_id})
    # Remove from other users' followers/following lists
    users_col.update_many({}, {"$pull": {"followers": user_id, "following": user_id}})
    # Remove from saved_posts on posts
    posts_col.update_many({}, {"$pull": {"saved_by": user_id, "liked_by": user_id}})

    users_col.delete_one({"_id": ObjectId(user_id)})
    return {"status": "deleted"}


@app.post("/users/{user_id}/follow")
def follow_user(user_id: str, current_user: dict = Depends(get_current_user)):
    me_id = current_user["sub"]
    if me_id == user_id:
        raise HTTPException(400, "Cannot follow yourself")

    target = r_users_col.find_one({"_id": ObjectId(user_id)})
    if not target:
        raise HTTPException(404, "User not found")

    already_following = me_id in target.get("followers", [])

    if already_following:
        users_col.update_one({"_id": ObjectId(user_id)}, {"$pull":     {"followers": me_id}})
        users_col.update_one({"_id": ObjectId(me_id)},   {"$pull":     {"following": user_id}})
        return {"status": "unfollowed"}
    else:
        users_col.update_one({"_id": ObjectId(user_id)}, {"$addToSet": {"followers": me_id}})
        users_col.update_one({"_id": ObjectId(me_id)},   {"$addToSet": {"following": user_id}})
        return {"status": "followed"}


@app.get("/users/{user_id}/saved-posts")
def saved_posts(user_id: str, current_user: dict = Depends(get_current_user)):
    if current_user["sub"] != user_id:
        raise HTTPException(403, "Cannot view another user's saved posts")
    user = r_users_col.find_one({"_id": ObjectId(user_id)}, {"saved_posts": 1})
    saved_ids = [ObjectId(pid) for pid in (user or {}).get("saved_posts", [])]
    posts = list(r_posts_col.find({"_id": {"$in": saved_ids}}).sort("created_at", -1))
    for p in posts:
        p["_id"] = str(p["_id"])
    return posts

# ═══════════════════════════════════════════════════════
# POSTS
# ═══════════════════════════════════════════════════════

ALLOWED_TAGS = {
    "achievement",
    "tip",
    "question",
    "internship open",
    "scholarship alert",
    "experience",
    "scholarship",
    "internship",
    "phd",
    "general",
    "merit",
    "need-based",
    "deadline",
    "result",
}

def _normalize_tag(tag: str) -> str:
    return (tag or "").strip().lower()


def _allowed_image_url(url: Optional[str]) -> bool:
    if not url:
        return True
    url = url.strip()
    local_prefix = f"{PUBLIC_BACKEND_URL}/uploads/"
    if url.startswith(local_prefix):
        return True
    if not CLOUDINARY_CLOUD_NAME:
        return False
    prefix = f"https://res.cloudinary.com/{CLOUDINARY_CLOUD_NAME}/"
    return url.startswith(prefix) or url.startswith(prefix.replace("https://", "http://"))


def degree_attestation_guide() -> dict:
    """
    Educational reference for Pakistani students — official steps change frequently;
    the UI exposes this alongside a disclaimer to verify on live portals.
    """
    return {
        "title": "Degree verification & attestation — reference guide",
        "disclaimer": (
            "Fees, forms, timings, and required documents change frequently. Always confirm "
            "the latest instructions on official BISE / FBISE, IBCC, MOFA, HEC, and embassy sites before "
            "visiting offices or courier services."
        ),
        "sections": [
            {
                "id": "bise",
                "authority": "Provincial BISE Boards",
                "summary": (
                    "Board of Intermediate & Secondary Education (BISE) attests secondary school certificates "
                    "(SSC) and intermediate (HSSC) transcripts issued under that board."
                ),
                "steps": [
                    "Identify the issuing board from your certificate (e.g. BISE Lahore, BISE Karachi).",
                    "Download the relevant attestation or verification form from that board portal (if offered). Photocopies of CNIC/NICOP and original documents are routinely required.",
                    "Pay challan fees at the prescribed bank branches and keep receipts.",
                    "Visit the designated board facilitation counter during working hours or use an approved online application where available.",
                    "Collect board-attested copies or verification letters as instructed; keep digital scans for IBCC equivalence.",
                ],
                "references": [{"label": "Find your provincial board portals", "url": "https://www.fbise.edu.pk/regional-office"}],
            },
            {
                "id": "fbise",
                "authority": "FBISE Islamabad",
                "summary": "Federal Board transcripts and SSC/HSSC certifications attested through FBISE HQ or regional offices.",
                "steps": [
                    "Locate your roll number, registration year, and exam type from your FBISE credential.",
                    "Use the FBISE learner services portal where available or visit the Headquarters / regional counter with originals and photocopies.",
                    "Clear applicable fee challans and biometric/CNIC verification as announced on their circulars.",
                    "Receive board-authenticated photocopies sealed per policy for onward submission to IBCC or foreign institutions.",
                ],
                "references": [{"label": "FBISE official site", "url": "https://www.fbise.edu.pk"}],
            },
            {
                "id": "ibcc",
                "authority": "IBCC (Inter Board Committee of Chairmen)",
                "summary": (
                    "IBCC verifies equivalency of SSC/HSSC credentials for study abroad embassies, foreign universities, and many employers."
                ),
                "steps": [
                    "Ensure your board has already endorsed the transcripts you plan to attest.",
                    "Complete the IBCC online pre-application (when active) selecting the embassy or institutional destination.",
                    "Upload crisp scans — CNIC/NICOP, latest photographs, transcripts, syllabus comparison if requested.",
                    "Pay online or bank challans as instructed; courier documents if biometric capture is waived.",
                    "Track application status electronically; IBCC issues Equivalence / Verification certificates you then pass to MOFA or HEC as required.",
                ],
                "references": [{"label": "IBCC portal", "url": "https://www.ibcc.edu.pk"}],
            },
            {
                "id": "mofa",
                "authority": "Ministry of Foreign Affairs (MOFA)",
                "summary": "MOFA legalises public documents for use outside Pakistan after prior educational authentication.",
                "steps": [
                    "Sequence matters: complete board/IBCC/HEC steps before MOFA unless the destination embassy states otherwise.",
                    "Book an e-ticket via the MOFA Consular Services portal for the correct category (educational).",
                    "Bring original credentials plus IBCC cover letter; MOFA attaches apostille-equivalent stamping for select countries.",
                    "Pay consular charges at designated banks; biometric verification may occur at the facilitation centre.",
                    "Forward MOFA-attested packs to embassies for student visa stamping if required.",
                ],
                "references": [{"label": "MOFA consular automation", "url": "https://mofa.gov.pk"}],
            },
            {
                "id": "hec",
                "authority": "Higher Education Commission (HEC)",
                "summary": (
                    "HEC verifies bachelor, master, or PhD degrees issued by chartered Pakistani universities for employment, admissions, "
                    "and scholarships."
                ),
                "steps": [
                    "Create/update your account on HEC's degree verification portal (Digi transcript / attestation workflows change over time — follow whichever module is publicly active).",
                    "Upload registrar-sealed transcripts, provisional certificate, CNIC/NICOP, and purpose letter (employment, admissions, embassy).",
                    "Pay service fees digitally; courier hard copies only if instructed by HEC ticketing support.",
                    "Track ticket status until HEC mails or emails you the verification letter or digital seal.",
                    "Couple HEC attestations with MOFA when foreign authorities request full-chain authentication.",
                ],
                "references": [{"label": "HEC homepage", "url": "https://www.hec.gov.pk"}],
            },
            {
                "id": "timeline",
                "authority": "Practical sequencing",
                "summary": (
                    "A typical outbound study route: Board → IBCC equivalence → MOFA → Embassy. "
                    "Job seekers often need HEC verification before HR overseas accepts Pakistani degrees."
                ),
                "steps": [
                    "Start 10–14 weeks ahead of embassy interviews or HR deadlines.",
                    "Maintain a certified-scan folder colour-coded per authority.",
                    "Use registered couriers between cities; duplicate attested sets for redundancy.",
                    "Keep translation certificates ready if programmes require sworn translations.",
                ],
                "references": [],
            },
        ],
    }


def _split_countries(raw: Optional[str]) -> List[str]:
    if not raw:
        return []
    return [p.strip().lower() for p in re.split(r"[,;/|]+", raw) if p.strip()]


def _interest_to_scholarship_types(interests: List[str]) -> List[str]:
    blob = (" ".join(interests)).lower()
    mapped: List[str] = []
    if "fully" in blob or "funded" in blob:
        mapped.append("funded")
    if "merit" in blob:
        mapped.append("merit")
    if "need" in blob:
        mapped.append("need")
    if "phd" in blob:
        mapped.append("phd")
    return list(dict.fromkeys(mapped)) or ["funded", "merit", "need", "phd"]


def _score_doc_for_profile(doc: dict, profile: dict, kind: str) -> int:
    score = 0
    majors = (profile.get("major") or "").lower()
    countries = _split_countries(profile.get("target_country") or "")
    interests = profile.get("interests") or []

    if kind == "scholarship":
        hay = (
            (doc.get("title") or "")
            + " "
            + (doc.get("eligibility") or "")
            + " "
            + (doc.get("country") or "")
        ).lower()
        ctype = doc.get("type")
        for t in _interest_to_scholarship_types(interests):
            if ctype == t:
                score += 3
        ctry = (doc.get("country") or "").lower()
        for co in countries:
            if co and co in ctry:
                score += 4
        for word in majors.split():
            if len(word) > 3 and word in hay:
                score += 2
        for i in interests:
            il = i.lower()
            if len(il) > 2 and il in hay:
                score += 1
    else:
        hay = (
            (doc.get("title") or "")
            + " "
            + (doc.get("field") or "")
            + " "
            + (doc.get("company") or "")
        ).lower()
        for word in majors.split():
            if len(word) > 3 and word in hay:
                score += 4
        for i in interests:
            il = i.lower()
            if "intern" in il:
                score += 2
            if len(il) > 2 and il in hay:
                score += 1
        loc = (doc.get("location") or "").lower()
        for co in countries:
            if co and co in loc:
                score += 2
    return score


@app.post("/posts", status_code=201)
def create_post(data: CreatePostRequest, current_user: dict = Depends(get_current_user)):
    normalized_tag = _normalize_tag(data.tag)
    if not normalized_tag or normalized_tag not in ALLOWED_TAGS:
        raise HTTPException(400, f"Invalid tag. Allowed: {ALLOWED_TAGS}")

    user_id = current_user["sub"]
    user = r_users_col.find_one(
        {"_id": ObjectId(user_id)}, {"name": 1, "handle": 1, "user_type": 1, "avatar": 1}
    )
    if not user:
        raise HTTPException(404, "User not found")

    img = (data.image_url or "").strip() or None
    if img:
        if not _allowed_image_url(img):
            raise HTTPException(400, "Image URL must come from SCHLR upload endpoint.")

    text_value = (data.text or "").strip()
    # Encourage more realistic posts
    if not text_value and not img:
        raise HTTPException(400, "Post must include text or an image.")
    if text_value and len(text_value) < 10:
        raise HTTPException(400, "Post text is too short; add more details (min 10 chars)")

    job_pid = (data.job_posting_id or "").strip() or None
    if job_pid:
        if user.get("user_type") != "recruiter" or user.get("status") != "approved":
            raise HTTPException(403, "Only approved recruiters can attach a job posting to community posts")
        job_oid = _parse_object_id(job_pid, "job_posting_id")
        job_doc = r_job_postings_col.find_one({"_id": job_oid})
        if not job_doc or job_doc.get("recruiter_id") != user_id:
            raise HTTPException(400, "Job posting not found or does not belong to your account")
        if job_doc.get("status") != "active":
            raise HTTPException(400, "That job posting is not active")

    post = {
        "user_id": user_id,
        "user_name": user["name"],
        "user_handle": user.get("handle", ""),
        "user_type": user.get("user_type", "student"),
        "user_avatar": user.get("avatar"),
        "user_profile": {
            "company": (user.get("profile") or {}).get("company_website") or (user.get("profile") or {}).get("university"),
            "recruiter_title": (user.get("profile") or {}).get("recruiter_title"),
            "industry": (user.get("profile") or {}).get("industry"),
        },
        "text": text_value,
        "tag": data.tag.strip(),
        "image_url": img,
        "job_posting_id": job_pid,
        "likes": 0,
        "liked_by": [],
        "comments": [],
        "saved_by": [],
        "created_at": datetime.utcnow(),
        "updated_at": None,
    }

    result = posts_col.insert_one(post)
    return {"status": "created", "post_id": str(result.inserted_id)}


@app.get("/posts")
def get_posts(page: int = 1, limit: int = 20, tag: Optional[str] = None):
    query = {}
    if tag:
        normalized_tag = _normalize_tag(tag)
        if normalized_tag not in ALLOWED_TAGS:
            raise HTTPException(400, f"Invalid tag. Allowed: {ALLOWED_TAGS}")
        query["tag"] = {"$regex": f"^{re.escape(tag.strip())}$", "$options": "i"}
    skip  = (page - 1) * limit
    posts = list(r_posts_col.find(query).sort("created_at", -1).skip(skip).limit(limit))
    total = r_posts_col.count_documents(query)
    for p in posts:
        p["_id"] = str(p["_id"])
    return {"posts": posts, "total": total, "page": page, "limit": limit}


@app.get("/posts/{post_id}")
def get_post(post_id: str):
    post = r_posts_col.find_one({"_id": ObjectId(post_id)})
    if not post:
        raise HTTPException(404, "Post not found")
    post["_id"] = str(post["_id"])
    return post


@app.put("/posts/{post_id}")
def update_post(
    post_id: str,
    data: CreatePostRequest,
    current_user: dict = Depends(get_current_user),
):
    normalized_tag = _normalize_tag(data.tag)
    if not normalized_tag or normalized_tag not in ALLOWED_TAGS:
        raise HTTPException(400, f"Invalid tag. Allowed: {ALLOWED_TAGS}")

    post = r_posts_col.find_one({"_id": ObjectId(post_id)})
    if not post:
        raise HTTPException(404, "Post not found")
    if post["user_id"] != current_user["sub"]:
        raise HTTPException(403, "Cannot edit another user's post")

    editor = r_users_col.find_one({"_id": ObjectId(current_user["sub"])}, {"user_type": 1}) or {}

    img = (data.image_url or "").strip() or None
    if img:
        if not _allowed_image_url(img):
            raise HTTPException(400, "Image URL must come from SCHLR upload endpoint.")

    text_value = (data.text or "").strip()
    if not text_value and not img:
        raise HTTPException(400, "Post must include text or an image.")

    set_doc = {
        "text": text_value,
        "tag": data.tag.strip(),
        "updated_at": datetime.utcnow(),
        "image_url": img,
    }
    try:
        submitted = data.model_dump(exclude_unset=True)
    except AttributeError:
        submitted = data.dict(exclude_unset=True)
    if "job_posting_id" in submitted:
        jp = (submitted.get("job_posting_id") or "").strip() or None
        if jp:
            if editor.get("user_type") != "recruiter":
                raise HTTPException(403, "Only recruiters can attach a job posting")
            job_oid = _parse_object_id(jp, "job_posting_id")
            job_doc = r_job_postings_col.find_one({"_id": job_oid})
            if not job_doc or job_doc.get("recruiter_id") != current_user["sub"]:
                raise HTTPException(400, "Job posting not found or does not belong to your account")
            set_doc["job_posting_id"] = jp
        else:
            set_doc["job_posting_id"] = None

    posts_col.update_one({"_id": ObjectId(post_id)}, {"$set": set_doc})
    return {"status": "updated"}


@app.delete("/posts/{post_id}")
def delete_post(post_id: str, current_user: dict = Depends(get_current_user)):
    post = r_posts_col.find_one({"_id": ObjectId(post_id)})
    if not post:
        raise HTTPException(404, "Post not found")
    if post["user_id"] != current_user["sub"]:
        raise HTTPException(403, "Cannot delete another user's post")
    posts_col.delete_one({"_id": ObjectId(post_id)})
    return {"status": "deleted"}


@app.post("/posts/{post_id}/like")
def like_post(post_id: str, current_user: dict = Depends(get_current_user)):
    user_id = current_user["sub"]
    # FIX: Read from RW client before a write to avoid replica-lag race condition
    post = posts_col.find_one({"_id": ObjectId(post_id)})
    if not post:
        raise HTTPException(404, "Post not found")

    if user_id in post.get("liked_by", []):
        posts_col.update_one(
            {"_id": ObjectId(post_id)},
            {"$pull": {"liked_by": user_id}, "$inc": {"likes": -1}},
        )
        return {"status": "unliked"}
    else:
        posts_col.update_one(
            {"_id": ObjectId(post_id)},
            {"$addToSet": {"liked_by": user_id}, "$inc": {"likes": 1}},
        )
        return {"status": "liked"}


@app.post("/posts/{post_id}/comment")
def add_comment(
    post_id: str,
    data: CommentRequest,
    current_user: dict = Depends(get_current_user),
):
    user_id = current_user["sub"]
    user    = r_users_col.find_one(
        {"_id": ObjectId(user_id)}, {"name": 1, "handle": 1, "avatar": 1}
    )

    comment = {
        "comment_id":  str(ObjectId()),
        "user_id":     user_id,
        "user_name":   user["name"] if user else "Unknown",
        "user_handle": user.get("handle", "") if user else "",
        "user_avatar": user.get("avatar") if user else None,
        "text":        data.text,
        "created_at":  datetime.utcnow(),
    }

    posts_col.update_one({"_id": ObjectId(post_id)}, {"$push": {"comments": comment}})

    # FIX: _serialize now handles datetime; deep-copy first to avoid mutating the stored doc
    return {"status": "comment added", "comment": _serialize(copy.deepcopy(comment))}


@app.delete("/posts/{post_id}/comment/{comment_id}")
def delete_comment(
    post_id: str,
    comment_id: str,
    current_user: dict = Depends(get_current_user),
):
    post = r_posts_col.find_one({"_id": ObjectId(post_id)})
    if not post:
        raise HTTPException(404, "Post not found")

    comment = next(
        (c for c in post.get("comments", []) if c.get("comment_id") == comment_id), None
    )
    if not comment:
        raise HTTPException(404, "Comment not found")
    if comment["user_id"] != current_user["sub"] and post["user_id"] != current_user["sub"]:
        raise HTTPException(403, "Not authorized to delete this comment")

    posts_col.update_one(
        {"_id": ObjectId(post_id)},
        {"$pull": {"comments": {"comment_id": comment_id}}},
    )
    return {"status": "comment deleted"}


@app.post("/posts/{post_id}/save")
def save_post(post_id: str, current_user: dict = Depends(get_current_user)):
    user_id = current_user["sub"]
    # FIX: Read from RW client before a write to avoid replica-lag race condition
    post = posts_col.find_one({"_id": ObjectId(post_id)})
    if not post:
        raise HTTPException(404, "Post not found")

    user  = users_col.find_one({"_id": ObjectId(user_id)}, {"saved_posts": 1})
    saved = (user or {}).get("saved_posts", [])

    if post_id in saved:
        users_col.update_one({"_id": ObjectId(user_id)}, {"$pull":     {"saved_posts": post_id}})
        posts_col.update_one( {"_id": ObjectId(post_id)},{"$pull":     {"saved_by": user_id}})
        return {"status": "unsaved"}
    else:
        users_col.update_one({"_id": ObjectId(user_id)}, {"$addToSet": {"saved_posts": post_id}})
        posts_col.update_one( {"_id": ObjectId(post_id)},{"$addToSet": {"saved_by": user_id}})
        return {"status": "saved"}

# ═══════════════════════════════════════════════════════
# SCHOLARSHIPS / INTERNSHIPS / APPLICATIONS / NOTIFICATIONS
# ═══════════════════════════════════════════════════════

VALID_SCHOLARSHIP_TYPES = {"merit", "need", "phd", "funded"}
VALID_APPLICATION_STATUSES = {"saved", "applied", "rejected"}
VALID_ITEM_TYPES = {"scholarship", "internship", "job_posting"}
VALID_NOTIFICATION_TYPES = {"deadline", "new", "message"}

@app.post("/scholarships", status_code=201)
def create_scholarship(data: ScholarshipRequest, current_user: dict = Depends(get_current_user)):
    if data.type not in VALID_SCHOLARSHIP_TYPES:
        raise HTTPException(400, f"Invalid scholarship type. Allowed: {VALID_SCHOLARSHIP_TYPES}")
    doc = {
        "title": data.title,
        "type": data.type,
        "country": data.country,
        "university": data.university,
        "amount": data.amount,
        "deadline": data.deadline,
        "eligibility": data.eligibility,
        "source_url": data.source_url,
        "apply_url": data.apply_url,
        "is_fully_funded": data.is_fully_funded,
        "scraped_at": data.scraped_at or datetime.utcnow(),
        "created_at": datetime.utcnow(),
        "updated_at": None,
    }
    result = scholarships_col.insert_one(doc)
    return {"status": "created", "id": str(result.inserted_id)}

@app.get("/scholarships")
def list_scholarships(
    page: int = 1,
    limit: int = 20,
    s_type: Optional[str] = None,
    country: Optional[str] = None,
    q: Optional[str] = None,
):
    query: Dict = {}
    if s_type:
        if s_type not in VALID_SCHOLARSHIP_TYPES:
            raise HTTPException(400, f"Invalid scholarship type. Allowed: {VALID_SCHOLARSHIP_TYPES}")
        query["type"] = s_type
    if country:
        query["country"] = country
    if q:
        query["$text"] = {"$search": q}

    skip = (page - 1) * limit
    docs = list(r_scholarships_col.find(query).sort("deadline", ASCENDING).skip(skip).limit(limit))
    total = r_scholarships_col.count_documents(query)
    for d in docs:
        d["_id"] = str(d["_id"])
        _serialize(d)
    return {"items": docs, "total": total, "page": page, "limit": limit}

@app.get("/scholarships/{scholarship_id}")
def get_scholarship(scholarship_id: str):
    oid = _parse_object_id(scholarship_id, "scholarship_id")
    doc = r_scholarships_col.find_one({"_id": oid})
    if not doc:
        raise HTTPException(404, "Scholarship not found")
    doc["_id"] = str(doc["_id"])
    return _serialize(doc)

@app.put("/scholarships/{scholarship_id}")
def update_scholarship(
    scholarship_id: str,
    data: ScholarshipRequest,
    current_user: dict = Depends(get_current_user),
):
    oid = _parse_object_id(scholarship_id, "scholarship_id")
    if data.type not in VALID_SCHOLARSHIP_TYPES:
        raise HTTPException(400, f"Invalid scholarship type. Allowed: {VALID_SCHOLARSHIP_TYPES}")

    update_doc = {
        "title": data.title,
        "type": data.type,
        "country": data.country,
        "university": data.university,
        "amount": data.amount,
        "deadline": data.deadline,
        "eligibility": data.eligibility,
        "source_url": data.source_url,
        "apply_url": data.apply_url,
        "is_fully_funded": data.is_fully_funded,
        "scraped_at": data.scraped_at or datetime.utcnow(),
        "updated_at": datetime.utcnow(),
    }
    res = scholarships_col.update_one({"_id": oid}, {"$set": update_doc})
    if res.matched_count == 0:
        raise HTTPException(404, "Scholarship not found")
    return {"status": "updated"}

@app.delete("/scholarships/{scholarship_id}")
def delete_scholarship(scholarship_id: str, current_user: dict = Depends(get_current_user)):
    oid = _parse_object_id(scholarship_id, "scholarship_id")
    scholarships_col.delete_one({"_id": oid})
    return {"status": "deleted"}

@app.post("/internships", status_code=201)
def create_internship(data: InternshipRequest, current_user: dict = Depends(get_current_user)):
    doc = {
        "title": data.title,
        "company": data.company,
        "location": data.location,
        "is_paid": data.is_paid,
        "stipend": data.stipend,
        "duration_weeks": data.duration_weeks,
        "deadline": data.deadline,
        "field": data.field,
        "apply_url": data.apply_url,
        "scraped_at": data.scraped_at or datetime.utcnow(),
        "created_at": datetime.utcnow(),
        "updated_at": None,
    }
    result = internships_col.insert_one(doc)
    return {"status": "created", "id": str(result.inserted_id)}

@app.get("/internships")
def list_internships(
    page: int = 1,
    limit: int = 20,
    location: Optional[str] = None,
    field: Optional[str] = None,
    q: Optional[str] = None,
):
    query: Dict = {}
    if location:
        query["location"] = location
    if field:
        query["field"] = field
    if q:
        query["$text"] = {"$search": q}

    skip = (page - 1) * limit
    docs = list(r_internships_col.find(query).sort("deadline", ASCENDING).skip(skip).limit(limit))
    total = r_internships_col.count_documents(query)
    for d in docs:
        d["_id"] = str(d["_id"])
        _serialize(d)
    return {"items": docs, "total": total, "page": page, "limit": limit}

@app.get("/internships/{internship_id}")
def get_internship(internship_id: str):
    oid = _parse_object_id(internship_id, "internship_id")
    doc = r_internships_col.find_one({"_id": oid})
    if not doc:
        raise HTTPException(404, "Internship not found")
    doc["_id"] = str(doc["_id"])
    return _serialize(doc)

@app.put("/internships/{internship_id}")
def update_internship(
    internship_id: str,
    data: InternshipRequest,
    current_user: dict = Depends(get_current_user),
):
    oid = _parse_object_id(internship_id, "internship_id")
    update_doc = {
        "title": data.title,
        "company": data.company,
        "location": data.location,
        "is_paid": data.is_paid,
        "stipend": data.stipend,
        "duration_weeks": data.duration_weeks,
        "deadline": data.deadline,
        "field": data.field,
        "apply_url": data.apply_url,
        "scraped_at": data.scraped_at or datetime.utcnow(),
        "updated_at": datetime.utcnow(),
    }
    res = internships_col.update_one({"_id": oid}, {"$set": update_doc})
    if res.matched_count == 0:
        raise HTTPException(404, "Internship not found")
    return {"status": "updated"}

@app.delete("/internships/{internship_id}")
def delete_internship(internship_id: str, current_user: dict = Depends(get_current_user)):
    oid = _parse_object_id(internship_id, "internship_id")
    internships_col.delete_one({"_id": oid})
    return {"status": "deleted"}

@app.post("/applications", status_code=201)
def create_application(data: ApplicationRequest, current_user: dict = Depends(get_current_user)):
    if data.item_type not in VALID_ITEM_TYPES:
        raise HTTPException(400, f"Invalid item_type. Allowed: {VALID_ITEM_TYPES}")
    if data.status not in VALID_APPLICATION_STATUSES:
        raise HTTPException(400, f"Invalid status. Allowed: {VALID_APPLICATION_STATUSES}")

    applicant = r_users_col.find_one({"_id": ObjectId(current_user["sub"])})
    if not applicant:
        raise HTTPException(404, "User not found")

    item_oid = _parse_object_id(data.item_id, "item_id")
    exists = None
    if data.item_type == "scholarship":
        exists = r_scholarships_col.find_one({"_id": item_oid})
    elif data.item_type == "internship":
        exists = r_internships_col.find_one({"_id": item_oid})
    else:
        # job_posting — recruiter-created internship/job listing
        if applicant.get("user_type") != "student":
            raise HTTPException(403, "Only student accounts can apply to recruiter job postings")
        exists = r_job_postings_col.find_one({"_id": item_oid})
        if exists:
            if exists.get("status") != "active":
                raise HTTPException(400, "This posting is no longer accepting applications")
            if exists.get("recruiter_id") == current_user["sub"]:
                raise HTTPException(400, "You cannot apply to your own job posting")

    if not exists:
        raise HTTPException(404, f"{data.item_type.replace('_', ' ').title()} not found")

    cv_url = (data.cv_url or "").strip() or None
    if data.item_type == "job_posting" and data.status == "applied":
        if not cv_url:
            prof = applicant.get("profile") or {}
            cv_url = (prof.get("cv_url") or "").strip() or None
        if not cv_url:
            raise HTTPException(400, "Upload your CV (PDF) or save one on your profile before submitting")

    doc = {
        "user_id": current_user["sub"],
        "item_id": data.item_id,
        "item_type": data.item_type,
        "status": data.status,
        "notes": data.notes,
        "cv_url": cv_url,
        "applied_at": datetime.utcnow() if data.status == "applied" else None,
        "created_at": datetime.utcnow(),
        "updated_at": None,
    }
    try:
        result = applications_col.insert_one(doc)
    except Exception:
        raise HTTPException(409, "Application already exists for this item")
    return {"status": "created", "id": str(result.inserted_id)}

@app.get("/applications/me")
def list_my_applications(
    status_filter: Optional[str] = None,
    item_type: Optional[str] = None,
    page: int = 1,
    limit: int = 20,
    current_user: dict = Depends(get_current_user),
):
    query: Dict = {"user_id": current_user["sub"]}
    if status_filter:
        if status_filter not in VALID_APPLICATION_STATUSES:
            raise HTTPException(400, f"Invalid status_filter. Allowed: {VALID_APPLICATION_STATUSES}")
        query["status"] = status_filter
    if item_type:
        if item_type not in VALID_ITEM_TYPES:
            raise HTTPException(400, f"Invalid item_type. Allowed: {VALID_ITEM_TYPES}")
        query["item_type"] = item_type

    skip = (page - 1) * limit
    docs = list(r_applications_col.find(query).sort("created_at", DESCENDING).skip(skip).limit(limit))
    total = r_applications_col.count_documents(query)
    for d in docs:
        d["_id"] = str(d["_id"])
        _serialize(d)
    return {"items": docs, "total": total, "page": page, "limit": limit}

@app.put("/applications/{application_id}")
def update_application(
    application_id: str,
    data: ApplicationRequest,
    current_user: dict = Depends(get_current_user),
):
    oid = _parse_object_id(application_id, "application_id")
    existing = r_applications_col.find_one({"_id": oid})
    if not existing:
        raise HTTPException(404, "Application not found")
    if existing["user_id"] != current_user["sub"]:
        raise HTTPException(403, "Cannot update another user's application")
    if data.item_type not in VALID_ITEM_TYPES:
        raise HTTPException(400, f"Invalid item_type. Allowed: {VALID_ITEM_TYPES}")
    if data.status not in VALID_APPLICATION_STATUSES:
        raise HTTPException(400, f"Invalid status. Allowed: {VALID_APPLICATION_STATUSES}")

    cv_u = (data.cv_url if data.cv_url is not None else existing.get("cv_url"))
    if isinstance(cv_u, str):
        cv_u = cv_u.strip() or None
    update_doc = {
        "item_id": data.item_id,
        "item_type": data.item_type,
        "status": data.status,
        "notes": data.notes,
        "cv_url": cv_u,
        "updated_at": datetime.utcnow(),
    }
    if data.item_type == "job_posting" and data.status == "applied":
        if not update_doc.get("cv_url"):
            applicant = r_users_col.find_one({"_id": ObjectId(current_user["sub"])}, {"profile": 1})
            prof = (applicant or {}).get("profile") or {}
            fallback_cv = (prof.get("cv_url") or "").strip() or None
            if fallback_cv:
                update_doc["cv_url"] = fallback_cv
        if not update_doc.get("cv_url"):
            raise HTTPException(400, "CV is required to mark this application as submitted")

    if data.status == "applied" and not existing.get("applied_at"):
        update_doc["applied_at"] = datetime.utcnow()
    applications_col.update_one({"_id": oid}, {"$set": update_doc})
    return {"status": "updated"}

@app.delete("/applications/{application_id}")
def delete_application(application_id: str, current_user: dict = Depends(get_current_user)):
    oid = _parse_object_id(application_id, "application_id")
    existing = r_applications_col.find_one({"_id": oid})
    if not existing:
        raise HTTPException(404, "Application not found")
    if existing["user_id"] != current_user["sub"]:
        raise HTTPException(403, "Cannot delete another user's application")
    applications_col.delete_one({"_id": oid})
    return {"status": "deleted"}

@app.post("/notifications", status_code=201)
def create_notification(data: NotificationRequest, current_user: dict = Depends(get_current_user)):
    if data.type not in VALID_NOTIFICATION_TYPES:
        raise HTTPException(400, f"Invalid type. Allowed: {VALID_NOTIFICATION_TYPES}")
    doc = {
        "user_id": current_user["sub"],
        "type": data.type,
        "message": data.message,
        "ref_id": data.ref_id,
        "is_read": False,
        "created_at": datetime.utcnow(),
    }
    result = notifications_col.insert_one(doc)
    return {"status": "created", "id": str(result.inserted_id)}

@app.get("/notifications/me")
def list_my_notifications(
    unread_only: bool = False,
    page: int = 1,
    limit: int = 20,
    current_user: dict = Depends(get_current_user),
):
    query: Dict = {"user_id": current_user["sub"]}
    if unread_only:
        query["is_read"] = False
    skip = (page - 1) * limit
    docs = list(r_notifications_col.find(query).sort("created_at", DESCENDING).skip(skip).limit(limit))
    total = r_notifications_col.count_documents(query)
    for d in docs:
        d["_id"] = str(d["_id"])
        _serialize(d)
    return {"items": docs, "total": total, "page": page, "limit": limit}

@app.put("/notifications/{notification_id}/read")
def mark_notification_read(notification_id: str, current_user: dict = Depends(get_current_user)):
    oid = _parse_object_id(notification_id, "notification_id")
    doc = r_notifications_col.find_one({"_id": oid})
    if not doc:
        raise HTTPException(404, "Notification not found")
    if doc["user_id"] != current_user["sub"]:
        raise HTTPException(403, "Cannot update another user's notification")
    notifications_col.update_one({"_id": oid}, {"$set": {"is_read": True}})
    return {"status": "read"}

@app.delete("/notifications/{notification_id}")
def delete_notification(notification_id: str, current_user: dict = Depends(get_current_user)):
    oid = _parse_object_id(notification_id, "notification_id")
    doc = r_notifications_col.find_one({"_id": oid})
    if not doc:
        raise HTTPException(404, "Notification not found")
    if doc["user_id"] != current_user["sub"]:
        raise HTTPException(403, "Cannot delete another user's notification")
    notifications_col.delete_one({"_id": oid})
    return {"status": "deleted"}

# ═══════════════════════════════════════════════════════
# DIRECT MESSAGES — REST
# ═══════════════════════════════════════════════════════

@app.get("/dm/threads")
def get_dm_threads(current_user: dict = Depends(get_current_user)):
    user_id = current_user["sub"]
    threads = list(r_dm_threads_col.find({"participants": user_id}).sort("updated_at", -1))
    for t in threads:
        t["_id"] = str(t["_id"])
        last_msg = r_dm_messages_col.find_one(
            {"thread_id": t["thread_id"]}, sort=[("created_at", -1)]
        )
        t["last_message"] = _serialize(copy.deepcopy(last_msg)) if last_msg else None
        other_id = next((p for p in t["participants"] if p != user_id), None)
        if other_id:
            other = r_users_col.find_one(
                {"_id": ObjectId(other_id)},
                {"name": 1, "handle": 1, "avatar": 1, "user_type": 1},
            )
            if other:
                other = _serialize(other)
                other["id"] = other.get("_id")
                t["other_user"] = other
            else:
                t["other_user"] = None
    return threads


@app.post("/dm/threads")
def create_or_get_thread(
    data: DMThreadRequest,
    current_user: dict = Depends(get_current_user),
):
    me_id        = current_user["sub"]
    recipient_id = data.recipient_id

    if me_id == recipient_id:
        raise HTTPException(400, "Cannot message yourself")

    thread_id = _get_thread_id(me_id, recipient_id)
    existing  = r_dm_threads_col.find_one({"thread_id": thread_id})

    if existing:
        existing["_id"] = str(existing["_id"])
        other_id = next((p for p in existing["participants"] if p != me_id), None)
        if other_id:
            other = r_users_col.find_one(
                {"_id": ObjectId(other_id)},
                {"name": 1, "handle": 1, "avatar": 1, "user_type": 1},
            )
            if other:
                other = _serialize(other)
                other["id"] = other.get("_id")
                existing["other_user"] = other
        return existing

    thread = {
        "thread_id":    thread_id,
        "participants": [me_id, recipient_id],
        "created_at":   datetime.utcnow(),
        "updated_at":   datetime.utcnow(),
    }
    result = dm_threads_col.insert_one(thread)
    thread["_id"] = str(result.inserted_id)
    return thread

@app.post("/dm/threads/{thread_id}/messages", status_code=201)
def send_thread_message(
    thread_id: str,
    data: DMMessageRequest,
    current_user: dict = Depends(get_current_user),
):
    user_id = current_user["sub"]
    thread = r_dm_threads_col.find_one({"thread_id": thread_id})
    if not thread or user_id not in thread["participants"]:
        raise HTTPException(403, "Access denied")

    text = (data.text or "").strip()
    if not text:
        raise HTTPException(400, "Message text is required")

    user_doc = r_users_col.find_one({"_id": ObjectId(user_id)}, {"name": 1})
    msg_doc = {
        "thread_id": thread_id,
        "sender_id": user_id,
        "sender_name": user_doc["name"] if user_doc else "",
        "text": text,
        "read": False,
        "created_at": datetime.utcnow(),
    }
    result = dm_messages_col.insert_one(msg_doc)
    dm_threads_col.update_one(
        {"thread_id": thread_id},
        {"$set": {"updated_at": datetime.utcnow()}},
    )

    msg_doc["_id"] = str(result.inserted_id)
    return _serialize(msg_doc)


@app.get("/dm/threads/{thread_id}/messages")
def get_thread_messages(
    thread_id: str,
    page: int = 1,
    limit: int = 50,
    current_user: dict = Depends(get_current_user),
):
    user_id = current_user["sub"]
    thread  = r_dm_threads_col.find_one({"thread_id": thread_id})
    if not thread or user_id not in thread["participants"]:
        raise HTTPException(403, "Access denied")

    skip = (page - 1) * limit
    msgs = list(
        r_dm_messages_col.find({"thread_id": thread_id})
        .sort("created_at", 1)
        .skip(skip)
        .limit(limit)
    )
    for m in msgs:
        m["_id"] = str(m["_id"])
    return msgs

# ═══════════════════════════════════════════════════════
# DIRECT MESSAGES — WEBSOCKET
# ═══════════════════════════════════════════════════════

@app.websocket("/ws/{user_id}")
async def websocket_endpoint(websocket: WebSocket, user_id: str, token: str = ""):
    try:
        payload = decode_token(token)
        if payload["sub"] != user_id:
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
            return
    except HTTPException:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    await manager.connect(websocket, user_id)
    user_doc = r_users_col.find_one({"_id": ObjectId(user_id)}, {"name": 1, "handle": 1})

    try:
        while True:
            raw = await websocket.receive_text()
            try:
                data = json.loads(raw)
            except json.JSONDecodeError:
                continue

            msg_type = data.get("type")

            if msg_type == "message":
                thread_id = data.get("thread_id")
                text      = (data.get("text") or "").strip()
                if not thread_id or not text:
                    continue

                thread = r_dm_threads_col.find_one({"thread_id": thread_id})
                if not thread or user_id not in thread["participants"]:
                    continue

                recipient_id = next(p for p in thread["participants"] if p != user_id)

                msg_doc = {
                    "thread_id":   thread_id,
                    "sender_id":   user_id,
                    "sender_name": user_doc["name"] if user_doc else "",
                    "text":        text,
                    "read":        False,
                    "created_at":  datetime.utcnow(),
                }
                result  = dm_messages_col.insert_one(msg_doc)
                msg_doc["_id"]        = str(result.inserted_id)
                msg_doc["created_at"] = msg_doc["created_at"].isoformat()

                dm_threads_col.update_one(
                    {"thread_id": thread_id},
                    {"$set": {"updated_at": datetime.utcnow()}},
                )

                await manager.send_to_user(recipient_id, {"type": "message", **msg_doc})
                await websocket.send_json({"type": "message_sent", **msg_doc})

            elif msg_type == "typing":
                recipient_id = data.get("recipient_id")
                thread_id    = data.get("thread_id", "")
                if recipient_id:
                    await manager.send_to_user(recipient_id, {
                        "type":      "typing",
                        "sender_id": user_id,
                        "thread_id": thread_id,
                    })

            elif msg_type == "read":
                thread_id = data.get("thread_id")
                if not thread_id:
                    continue

                dm_messages_col.update_many(
                    {"thread_id": thread_id, "sender_id": {"$ne": user_id}, "read": False},
                    {"$set": {"read": True}},
                )

                thread = r_dm_threads_col.find_one({"thread_id": thread_id})
                if thread:
                    other_id = next(
                        (p for p in thread["participants"] if p != user_id), None
                    )
                    if other_id:
                        await manager.send_to_user(other_id, {
                            "type":      "read",
                            "thread_id": thread_id,
                            "reader_id": user_id,
                        })

    except WebSocketDisconnect:
        manager.disconnect(websocket, user_id)