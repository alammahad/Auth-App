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
from pymongo.errors import CollectionInvalid, DuplicateKeyError, OperationFailure
from datetime import datetime, timedelta

# ✅ Local imports
from scraper import WebScraper
from vector_store import VectorStore
from chroma_store import ChromaStore
from news_scraper import run_news_scrape as _run_news_scrape_feeds, cleanup_old_news as _cleanup_old_news

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
        connections_col,
        notifications_col,
        job_postings_col,
        news_col,
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
        r_news_col,
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
        connections_col,
        notifications_col,
        job_postings_col,
        news_col,
        r_users_col,
        r_posts_col,
        r_messages_col,
        r_dm_messages_col,
        r_dm_threads_col,
        r_scholarships_col,
        r_internships_col,
        r_applications_col,
        r_connections_col,
        r_notifications_col,
        r_job_postings_col,
        r_news_col,
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
    return r_users_col.find_one({"_id": _safe_user_id(current_user["sub"])})

from opportunity_scraper import persist_opportunities_from_chunks, backfill_internship_normalization
def _ensure_collection(name: str, validator: dict) -> None:
    try:
        mongo_db.create_collection(name, validator=validator)
    except CollectionInvalid:
        try:
            mongo_db.command(
                {
                    "collMod": name,
                    "validator": validator,
                    "validationLevel": "moderate",
                }
            )
        except OperationFailure:
            # Existing collections may not allow validator modification on some MongoDB tiers.
            pass
    except OperationFailure:
        # Atlas shared tiers may restrict collMod/create validators; continue safely.
        pass


def init_database_schema() -> None:
    if mongo_db is None:
        print("Warning: Skipping database schema initialization because MongoDB connection is None")
        return
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
                    "banner": {"bsonType": ["string", "null"]},
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
                    "source_name": {"bsonType": "string"},
                    "degree_level": {"bsonType": "string"},
                    "funding_type": {"bsonType": "string"},
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
    internships_col.create_index([("workplace_type", ASCENDING), ("country", ASCENDING), ("city", ASCENDING)])
    internships_col.create_index([("is_paid", ASCENDING), ("has_stipend", ASCENDING)])
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

    if news_col is not None:
        news_col.create_index([("published_at", DESCENDING)])
        news_col.create_index([("url_hash", ASCENDING)], unique=True, sparse=True)
        news_col.create_index([("tag", ASCENDING), ("published_at", DESCENDING)])

# ═══════════════════════════════════════════════════════
# ANTHROPIC / RAG CONFIG
# ═══════════════════════════════════════════════════════

ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")

# Auto-detect if user put a Gemini key inside ANTHROPIC_API_KEY
if ANTHROPIC_API_KEY and not ANTHROPIC_API_KEY.startswith("sk-ant-") and ANTHROPIC_API_KEY != "yahan_apni_real_key_dalo":
    if not GEMINI_API_KEY:
        GEMINI_API_KEY = ANTHROPIC_API_KEY
    ANTHROPIC_API_KEY = None

if not ANTHROPIC_API_KEY and not GEMINI_API_KEY and not OPENAI_API_KEY:
    raise ValueError("Neither ANTHROPIC_API_KEY nor GEMINI_API_KEY nor OPENAI_API_KEY is defined in .env")

# FIX: Corrected model identifier
CLAUDE_MODEL = "claude-sonnet-4-5-20251001"

URLS_TO_SCRAPE: List[str] = [
    "https://www.hec.gov.pk/site/scholarships",
    "https://www.hec.gov.pk/english/scholarshipsgrants/Pages/internationalScholarships.aspx",
    "https://www.hec.gov.pk/english/scholarshipsgrants/Pages/NationalScholarships.aspx",
    "https://scholarship.hec.gov.pk/",
    "https://educationusa.state.gov/find-financial-aid",
    "https://studentaid.gov/",
    "https://www.educanada.ca/scholarships-bourses/index.aspx?lang=eng",
    "https://www.studyaustralia.gov.au/en/plan-your-studies/scholarships",
    "https://www.dfat.gov.au/people-to-people/australia-awards",
    "https://www.mext.go.jp/en/policy/education/highered/title02/detail02/1373860.htm",
    "https://www.studyinjapan.go.jp/en/planning/scholarships/",
    "https://www.jasso.go.jp/en/ryugaku/scholarship_j/index.html",
    "https://www.turkiyeburslari.gov.tr/",
    "https://www.studyinkorea.go.kr/",
    "https://www.campuschina.org/",
    "https://www.chevening.org/scholarships/",
    "https://www.chevening.org/scholarship/pakistan/",
    "https://cscuk.fcdo.gov.uk/scholarships/",
    "https://www.daad.de/stipdb-redirect/",
    "https://www.daad.de/en/studying-in-germany/scholarships/",
    "https://www.daad.pk/en/find-funding/scholarship-database/",
    "https://www.eacea.ec.europa.eu/scholarships/erasmus-mundus-catalogue_en",
    "https://erasmus-plus.ec.europa.eu/opportunities/opportunities-for-individuals/students",
    "https://study-uk.britishcouncil.org/scholarships-funding",
    "https://www.britishcouncil.pk/study-uk/scholarships-funding",
    "https://www.britishcouncil.pk/study-uk/scholarships-funding/great-scholarships-pakistan",
    "https://www.gatescambridge.org/",
    "https://www.rhodeshouse.ox.ac.uk/scholarships/the-rhodes-scholarship/",
    "https://www.knight-hennessy.stanford.edu/",
    "https://vanier.gc.ca/en/home-accueil.html",
    "https://banting.fellowships-bourses.gc.ca/",
    "https://si.se/en/apply/scholarships/",
    "https://www.studyinnl.org/finances/nl-scholarship",
    "https://www.nzscholarships.govt.nz/",
    "https://www.isdb.org/scholarships",
    "https://www.worldbank.org/en/programs/scholarships",
    "https://www.adb.org/work-with-us/careers/japan-scholarship-program",
    "https://the.akdn/en/how-we-work/our-agencies/aga-khan-foundation/international-scholarship-programme",
    "https://www.rotary.org/en/our-programs/scholarships",
    "https://www.ox.ac.uk/admissions/graduate/fees-and-funding",
    "https://www.cam.ac.uk/study-at-cambridge/fees-and-finance",
    "https://www.cambridgetrust.org/scholarships/",
    "https://www.harvard.edu/admissions-aid/",
    "https://financialaid.stanford.edu/",
    "https://sfs.mit.edu/",
    "https://www.yale.edu/admissions/financial-aid",
    "https://admission.princeton.edu/financial-aid",
    "https://www.utoronto.ca/financial-aid",
    "https://students.ubc.ca/enrolment/finances/awards-scholarships-bursaries",
    "https://www.unimelb.edu.au/scholarships",
    "https://www.sydney.edu.au/scholarships/",
    "https://www.unsw.edu.au/study/how-to-apply/scholarships",
    "https://www.scholarships.com/",
    "https://www.fastweb.com/",
    "https://bigfuture.collegeboard.org/scholarship-search",
    "https://bold.org/scholarships/",
    "https://www.iefa.org/scholarships",
    "https://www.internationalscholarships.com/",
    "https://www.internationalstudent.com/scholarships/",
    "https://www.mastersportal.com/scholarships/",
    "https://www.wemakescholars.com/scholarship",
    "https://www.scholarshiptab.com/",
    "https://www.scholars4dev.com/category/scholarships-list/",
    "https://scholarsapp.com/",
    "https://www.timeshighereducation.com/student/advice/scholarships",
    "https://www.topuniversities.com/student-info/scholarship-advice",
    "https://www.studyinternational.com/news/category/scholarships/",
    "https://www.study.eu/scholarships",
    "https://www.findamasters.com/guides/postgraduate-scholarships",
    "https://www.findaphd.com/guides/phd-scholarships"
]

TOP_K_CHUNKS = 5

if ANTHROPIC_API_KEY and ANTHROPIC_API_KEY != "yahan_apni_real_key_dalo":
    claude_client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)
else:
    claude_client = None
scraper       = WebScraper()
# ChromaStore: persists embeddings to ./chroma_db/ on disk.
# Falls back to in-memory keyword search if chromadb package is not installed.
vector_store  = ChromaStore()

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

_USER_MUTABLE_FIELDS   = {"name", "handle", "avatar", "banner", "bio", "profile", "followers", "following", "saved_posts", "updated_at"}
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
        if scholarships_col is not None:
            scholarships_col.delete_many({"scraped_at": {"$exists": True, "$ne": None}})
        if internships_col is not None:
            internships_col.delete_many({"scraped_at": {"$exists": True, "$ne": None}})

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


def run_ai_chat_scrape() -> Dict:
    """
    Dedicated AI-chat ChromaDB scrape job.

    Runs every day at 2:00 AM (scheduled in lifespan).
    Re-crawls all scholarship/opportunity URLs and refreshes the ChromaDB
    vector store so the AI assistant always has fresh context.
    """
    print("[AIChatScrape] Starting nightly ChromaDB refresh...")
    try:
        vector_store.clear()
        chunks = scraper.scrape_urls(URLS_TO_SCRAPE)
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
        print(f"[AIChatScrape] Done — {added} chunks stored in ChromaDB (total={vector_store.count()}).")
        return {"chunks_added": added, "total": vector_store.count()}
    except Exception as e:
        print(f"[AIChatScrape] Error: {e}")
        return {"error": str(e)}


def run_news_scrape_job() -> Dict:
    """
    Dedicated news RSS scrape job.

    Runs every day at 2:05 AM (scheduled in lifespan).
    Fetches headlines from education RSS feeds and upserts into
    MongoDB `news_articles` collection. Auto-cleans articles older than 30 days.
    """
    print("[NewsScrapeJob] Starting nightly news feed refresh...")
    try:
        stats = _run_news_scrape_feeds(news_col)
        print(f"[NewsScrapeJob] Done — {stats}")
        return stats
    except Exception as e:
        print(f"[NewsScrapeJob] Error: {e}")
        return {"error": str(e)}


def run_news_cleanup_job() -> Dict:
    """
    Dedicated news cleanup job.

    Runs every day at 2:10 AM (after the RSS scrape job).
    Removes all news articles whose `published_at` is older than 30 days.
    """
    print("[NewsCleanupJob] Removing news articles older than 30 days...")
    try:
        stats = _cleanup_old_news(news_col)
        print(f"[NewsCleanupJob] Done — {stats}")
        return stats
    except Exception as e:
        print(f"[NewsCleanupJob] Error: {e}")
        return {"error": str(e)}


def run_opportunity_scrape_only() -> Dict:
    """Re-crawl seed URLs and refresh scholarships/internships without touching the vector DB."""
    if scholarships_col is not None:
        scholarships_col.delete_many({"scraped_at": {"$exists": True, "$ne": None}})
    if internships_col is not None:
        internships_col.delete_many({"scraped_at": {"$exists": True, "$ne": None}})
    chunks = scraper.scrape_urls(URLS_TO_SCRAPE)
    stats = persist_opportunities_from_chunks(chunks, scholarships_col, internships_col)
    return {"mode": "opportunities_only", **stats}

def seed_dummy_content() -> None:
    if mongo_db is None or posts_col is None:
        print("Warning: Skipping database seeding because MongoDB connection is None")
        return
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

    # Re-seed if no internships or old-format entries missing workplace_type
    if internships_col.count_documents({}) == 0 or internships_col.count_documents({"workplace_type": {"$exists": False}}) > 0:
        internships_col.delete_many({"scraped_at": {"$exists": True}, "workplace_type": {"$exists": False}})
        internships_col.delete_many({"company": "TechBridge"})  # Remove old single seed
        now = datetime.utcnow()
        seed_internships = [
            {
                "title": "Software Engineering Intern",
                "company": "TechBridge GmbH",
                "location": "Berlin, Germany",
                "country": "Germany",
                "city": "Berlin",
                "workplace_type": "onsite",
                "is_paid": True,
                "has_stipend": True,
                "stipend": 1200.0,
                "stipend_currency": "EUR",
                "duration_weeks": 12,
                "deadline": now + timedelta(days=45),
                "field": "Software Engineering",
                "apply_url": "https://example.com/techbridge-apply",
                "scraped_at": now,
                "created_at": now,
                "updated_at": None,
            },
            {
                "title": "Data Science Research Intern",
                "company": "DataVision Labs",
                "location": "Remote",
                "country": None,
                "city": None,
                "workplace_type": "remote",
                "is_paid": True,
                "has_stipend": True,
                "stipend": 800.0,
                "stipend_currency": "USD",
                "duration_weeks": 16,
                "deadline": now + timedelta(days=60),
                "field": "Data Science",
                "apply_url": "https://example.com/datavision-apply",
                "scraped_at": now,
                "created_at": now,
                "updated_at": None,
            },
            {
                "title": "Marketing & Communications Intern",
                "company": "GlobalReach Media",
                "location": "London, United Kingdom",
                "country": "United Kingdom",
                "city": "London",
                "workplace_type": "hybrid",
                "is_paid": False,
                "has_stipend": False,
                "stipend": None,
                "stipend_currency": None,
                "duration_weeks": 8,
                "deadline": now + timedelta(days=30),
                "field": "Marketing",
                "apply_url": "https://example.com/globalreach-apply",
                "scraped_at": now,
                "created_at": now,
                "updated_at": None,
            },
            {
                "title": "AI / Machine Learning Intern",
                "company": "InnovateMind",
                "location": "Toronto, Canada",
                "country": "Canada",
                "city": "Toronto",
                "workplace_type": "onsite",
                "is_paid": True,
                "has_stipend": True,
                "stipend": 2000.0,
                "stipend_currency": "CAD",
                "duration_weeks": 24,
                "deadline": now + timedelta(days=90),
                "field": "Artificial Intelligence",
                "apply_url": "https://example.com/innovatemind-apply",
                "scraped_at": now,
                "created_at": now,
                "updated_at": None,
            },
            {
                "title": "UX Design Intern",
                "company": "Pixel Craft Studio",
                "location": "Remote",
                "country": None,
                "city": None,
                "workplace_type": "remote",
                "is_paid": False,
                "has_stipend": False,
                "stipend": None,
                "stipend_currency": None,
                "duration_weeks": 10,
                "deadline": now + timedelta(days=50),
                "field": "UX Design",
                "apply_url": "https://example.com/pixelcraft-apply",
                "scraped_at": now,
                "created_at": now,
                "updated_at": None,
            },
        ]
        internships_col.insert_many(seed_internships)

    # ── Backfill normalization for any internships missing workplace_type ──
    if internships_col is not None:
        n = backfill_internship_normalization(internships_col)
        if n:
            print(f"[Backfill] Normalized {n} internship record(s) with workplace_type/country/city/stipend fields.")



# ═══════════════════════════════════════════════════════
# LIFESPAN
# ═══════════════════════════════════════════════════════

@asynccontextmanager
async def lifespan(app: FastAPI):
    global _scheduler
    init_database_schema()
    seed_dummy_content()
    if mongo_db is not None:
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
        # AI Chat ChromaDB refresh — every day at 2:00 AM
        _scheduler.add_job(
            run_ai_chat_scrape, CronTrigger(hour=2, minute=0),
            id="ai_chat_chroma_scrape", replace_existing=True,
        )
        # News RSS feed refresh — every day at 2:05 AM (offset to avoid overlap)
        _scheduler.add_job(
            run_news_scrape_job, CronTrigger(hour=2, minute=5),
            id="news_rss_scrape", replace_existing=True,
        )
        # News cleanup — every day at 2:10 AM (after scrape, removes articles > 30 days old)
        _scheduler.add_job(
            run_news_cleanup_job, CronTrigger(hour=2, minute=10),
            id="news_cleanup", replace_existing=True,
        )
        # Opportunity scrape (scholarships/internships to MongoDB) — 2pm daily
        _scheduler.add_job(
            run_opportunity_scrape_only, CronTrigger(hour=14, minute=0),
            id="midday_opportunities", replace_existing=True,
        )
        _scheduler.start()
        print("[Scheduler] Jobs registered: ai_chat_chroma_scrape@02:00, news_rss_scrape@02:05, news_cleanup@02:10, midday_opportunities@14:00")
    yield
    if _scheduler and _scheduler.running:
        _scheduler.shutdown(wait=False)

# ═══════════════════════════════════════════════════════
# APP
# ═══════════════════════════════════════════════════════

# FIX: Wildcard origin + allow_credentials=True is rejected by browsers
#      and is a security misconfiguration. Default to localhost only.
#      Include both 5173 and 5174 since Vite auto-increments the port when 5173 is busy.
_raw_origins    = os.getenv(
    "ALLOWED_ORIGINS",
    "http://localhost:3000,http://localhost:5173,http://localhost:5174,http://127.0.0.1:3000,http://127.0.0.1:5173,http://127.0.0.1:5174",
)
_origins_list = [o.strip() for o in _raw_origins.split(",") if o.strip()]
# Always ensure Vite dev ports are in the list (safety net)
for _port in ("5173", "5174", "5175"):
    for _host in ("http://localhost", "http://127.0.0.1"):
        _origin = f"{_host}:{_port}"
        if _origin not in _origins_list:
            _origins_list.append(_origin)
ALLOWED_ORIGINS = _origins_list

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




class ChangePasswordRequest(BaseModel):
    old_password: str
    new_password: str




class UpdateUserRequest(BaseModel):
    name: Optional[str] = None
    bio: Optional[str] = None
    avatar: Optional[str] = None
    banner: Optional[str] = None
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
    recipient_id: Optional[str] = None
    recipient_ids: Optional[List[str]] = None

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
    location: str                            # human-readable e.g. "Berlin, Germany"
    country: Optional[str] = None            # normalized country e.g. "Germany"
    city: Optional[str] = None               # normalized city e.g. "Berlin"
    workplace_type: str = "onsite"           # "remote" | "onsite" | "hybrid"
    is_paid: bool = False
    has_stipend: bool = False
    stipend: Optional[float] = None          # monthly stipend in PKR/USD
    stipend_currency: Optional[str] = "USD"
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
    return "_".join(sorted(list(set([uid1, uid2]))))

def _get_thread_id_multiple(uids: List[str]) -> str:
    return "_".join(sorted(list(set(uids))))

def _populate_thread_users(thread, me_id):
    participants = thread.get("participants", [])
    other_ids = [p for p in participants if p != me_id]
    if not other_ids and len(participants) > 0:
        other_ids = [me_id]
    
    other_users = []
    for oid in other_ids:
        other = r_users_col.find_one(
            {"_id": _safe_user_id(oid)},
            {"name": 1, "handle": 1, "avatar": 1, "user_type": 1},
        )
        if other:
            other = _serialize(other)
            other["id"] = other.get("_id")
            other["is_online"] = manager.is_online(oid)
            other_users.append(other)
            
    thread["other_users"] = other_users
    if len(other_users) == 1:
        thread["other_user"] = other_users[0]
    elif len(other_users) > 1:
        thread["other_user"] = {
            "id": "group_" + thread["thread_id"],
            "name": ", ".join(u["name"] for u in other_users),
            "handle": ", ".join(u["handle"] for u in other_users),
            "avatar": None,
            "user_type": "group"
        }
    else:
        thread["other_user"] = None
    return thread

def _parse_object_id(value: str, field_name: str = "id") -> ObjectId:
    try:
        return ObjectId(value)
    except Exception:
        raise HTTPException(400, f"Invalid {field_name}")

def _safe_user_id(uid):
    if uid is None:
        return None
    if isinstance(uid, ObjectId):
        return uid
    if ObjectId.is_valid(uid):
        return ObjectId(uid)
    return uid

def _build_system_prompt(
    contexts: List[dict], 
    db_scholarships: List[dict] = None, 
    db_internships: List[dict] = None, 
    db_stats: dict = None,
    user_profile: dict = None,
    user_name: str = None
) -> str:
    blocks = [
        f"[Source {i} | {c['url']} | score {c.get('score', 0)}]\n{c['text']}"
        for i, c in enumerate(contexts, 1)
    ]
    
    db_blocks = []
    if db_scholarships:
        for ds in db_scholarships:
            deadline_str = ds['deadline'].strftime("%Y-%m-%d") if isinstance(ds.get('deadline'), datetime) else str(ds.get('deadline'))
            db_blocks.append(
                f"[Structured Scholarship | Title: {ds.get('title')} | Source: {ds.get('source_name', 'Unknown')} | "
                f"Country: {ds.get('country')} | Type: {ds.get('type')} | Level: {ds.get('degree_level', 'Unknown')} | "
                f"Funding: {ds.get('funding_type', 'Unknown')} | Deadline: {deadline_str} | Apply URL: {ds.get('apply_url')}]\n"
                f"Eligibility: {ds.get('eligibility')}"
            )
            
    db_int_blocks = []
    if db_internships:
        for di in db_internships:
            deadline_str = di['deadline'].strftime("%Y-%m-%d") if isinstance(di.get('deadline'), datetime) else str(di.get('deadline'))
            db_int_blocks.append(
                f"[Structured Internship | Title: {di.get('title')} | Company: {di.get('company')} | "
                f"Location: {di.get('location')} | Field: {di.get('field')} | Stipend: {di.get('stipend', 'N/A')} | "
                f"Paid: {di.get('is_paid', False)} | Duration: {di.get('duration_weeks', 'N/A')} weeks | "
                f"Deadline: {deadline_str} | Apply URL: {di.get('apply_url')}]"
            )
            
    system_text = (
        "You are SCHLR AI, a helpful assistant trained specifically for the SCHLR (ScholarAI) website.\n"
        "You must only answer questions related to scholarships, internships, CVs, admissions, and educational opportunities on SCHLR.\n"
        "If the user asks an unrelated question (such as recipes, coding, general trivia, gaming, etc.), politely decline and explain that you are only trained for the SCHLR website.\n"
        "Otherwise, answer ONLY from the context and database statistics provided below.\n\n"
    )
    
    if user_name or user_profile:
        system_text += "USER PROFILE INFORMATION:\n"
        if user_name:
            system_text += f"- Name: {user_name}\n"
        if user_profile:
            for k, v in user_profile.items():
                if v:
                    system_text += f"- {k.replace('_', ' ').title()}: {v}\n"
        system_text += "\n"

    if db_stats:
        system_text += "DATABASE STATISTICS:\n"
        system_text += f"- Total internships available in system: {db_stats.get('total_internships', 0)}\n"
        system_text += f"- Total scholarships available in system: {db_stats.get('total_scholarships', 0)}\n"
        if 'matching_internships' in db_stats:
            system_text += f"- Internships matching user profile constraints (Field/Location): {db_stats.get('matching_internships', 0)}\n"
        if 'matching_scholarships' in db_stats:
            system_text += f"- Scholarships matching user profile constraints (Degree/Location): {db_stats.get('matching_scholarships', 0)}\n"
        system_text += "\n"
    
    if db_blocks:
        system_text += "STRUCTURED FACTUAL SCHOLARSHIPS:\n" + "\n\n---\n\n".join(db_blocks) + "\n\n"
        
    if db_int_blocks:
        system_text += "STRUCTURED FACTUAL INTERNSHIPS:\n" + "\n\n---\n\n".join(db_int_blocks) + "\n\n"
        
    system_text += "SCRAPED PAGE CHUNKS CONTEXT:\n" + "\n\n---\n\n".join(blocks) + "\n\n"
    
    system_text += (
        "RULES:\n"
        "- Be concise and direct.\n"
        "- If the answer is not in the context or database content, say: \"I couldn't find that in the database or scraped content.\"\n"
        "- Do NOT make up facts.\n"
        "- Do NOT mention or output any external source URLs, website links, or domain names in your answer. Keep all references local to the SCHLR platform.\n"
    )
    return system_text


def _build_general_assistant_system(bot_type: str, user_profile: dict = None, user_name: str = None) -> str:
    base = (
        "You are SCHLR AI — a concise, professional advisor for scholarships, internships, CVs, and study preparation.\n"
        "You are trained specifically for the SCHLR (ScholarAI) website. You must only answer questions related to scholarships, internships, CVs, admissions, and educational opportunities on SCHLR.\n"
        "If the user asks about completely unrelated topics (like gaming, recipes, general coding, pop culture, etc.), politely decline to answer, explaining that you are only trained to assist with SCHLR educational and career queries.\n"
    )
    
    if user_name or user_profile:
        base += "\nUSER PROFILE INFORMATION:\n"
        if user_name:
            base += f"- Name: {user_name}\n"
        if user_profile:
            for k, v in user_profile.items():
                if v:
                    base += f"- {k.replace('_', ' ').title()}: {v}\n"

    base += (
        "\nNo SCHLR knowledge-base snippets matched this question.\n"
        "Give generally sound guidance; do not invent specific program names, deadlines, acceptance rates, fees, or URLs.\n"
        "If facts are uncertain, say so and suggest checking official sources (universities, HEC, IBCC, MOFA, embassies).\n"
        "Use brief headings and bullets when helpful.\n"
    )
    prefix = BOT_SYSTEM_PROMPTS.get(bot_type)
    if prefix:
        return prefix + "\n\n" + base
    return base


def _generate_answer(
    question: str, 
    history: List[dict], 
    contexts: List[dict], 
    bot_type: str = "general", 
    db_scholarships: List[dict] = None,
    db_internships: List[dict] = None,
    db_stats: dict = None,
    user_profile: dict = None,
    user_name: str = None
) -> str:
    messages = [{"role": h["role"], "content": h["content"]} for h in history]
    messages.append({"role": "user", "content": question})
    if contexts or db_scholarships or db_internships or db_stats:
        system = _build_system_prompt(contexts, db_scholarships, db_internships, db_stats, user_profile, user_name)
        bot_prefix = BOT_SYSTEM_PROMPTS.get(bot_type)
        if bot_prefix:
            system = bot_prefix + "\n\n" + system
    else:
        system = _build_general_assistant_system(bot_type, user_profile, user_name)

    if OPENAI_API_KEY:
        import httpx
        url = "https://api.openai.com/v1/chat/completions"
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {OPENAI_API_KEY}"
        }
        openai_messages = []
        if system:
            openai_messages.append({"role": "system", "content": system})
        for msg in messages:
            openai_messages.append({"role": msg["role"], "content": msg["content"]})
            
        payload = {
            "model": "gpt-4o-mini",
            "messages": openai_messages,
            "max_tokens": 1024
        }
        with httpx.Client(timeout=30.0) as client:
            r = client.post(url, json=payload, headers=headers)
            r.raise_for_status()
            res_json = r.json()
            try:
                return res_json["choices"][0]["message"]["content"].strip()
            except (KeyError, IndexError):
                raise ValueError(f"Unexpected response structure from OpenAI API: {res_json}")
    elif GEMINI_API_KEY and (not claude_client or not ANTHROPIC_API_KEY or ANTHROPIC_API_KEY == "yahan_apni_real_key_dalo"):
        import httpx
        gemini_contents = []
        for msg in messages:
            role = "user" if msg["role"] == "user" else "model"
            gemini_contents.append({
                "role": role,
                "parts": [{"text": msg["content"]}]
            })
        payload = {
            "contents": gemini_contents,
            "generationConfig": {
                "maxOutputTokens": 1024
            }
        }
        if system:
            payload["systemInstruction"] = {
                "parts": [{"text": system}]
            }
        headers = {"Content-Type": "application/json"}
        url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={GEMINI_API_KEY}"
        
        with httpx.Client(timeout=30.0) as client:
            r = client.post(url, json=payload, headers=headers)
            r.raise_for_status()
            res_json = r.json()
            try:
                return res_json["candidates"][0]["content"]["parts"][0]["text"].strip()
            except (KeyError, IndexError):
                raise ValueError(f"Unexpected response structure from Gemini API: {res_json}")
    else:
        if not claude_client:
            raise ValueError("Claude client is not initialized and no GEMINI_API_KEY/OPENAI_API_KEY is configured.")
        response = claude_client.messages.create(
            model=CLAUDE_MODEL, max_tokens=1024, system=system, messages=messages,
        )
        return response.content[0].text.strip()

# ═══════════════════════════════════════════════════════
# CORE ROUTES
# ═══════════════════════════════════════════════════════

@app.get("/")
def root():
    if OPENAI_API_KEY:
        provider = "OpenAI"
        model = "gpt-4o-mini"
    elif GEMINI_API_KEY and (not claude_client or not ANTHROPIC_API_KEY or ANTHROPIC_API_KEY == "yahan_apni_real_key_dalo"):
        provider = "Gemini"
        model = "gemini-2.5-flash"
    else:
        provider = "Claude"
        model = CLAUDE_MODEL
        
    return {
        "status": "running",
        "chunks_in_db": vector_store.count(),
        "provider": provider,
        "model": model
    }

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
    mongo_ok = r_scholarships_col is not None
    return {
        "status": "ok",
        "mongo": mongo_ok,
        "vector_chunks": vector_store.count() if hasattr(vector_store, "count") else 0,
        "scholarships": r_scholarships_col.count_documents({}) if mongo_ok else 0,
        "internships": r_internships_col.count_documents({}) if r_internships_col is not None else 0,
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

    db_scholarships = []
    try:
        db_scholarships = list(r_scholarships_col.find({"$text": {"$search": question}}).limit(3))
    except Exception:
        pass

    db_internships = []
    try:
        db_internships = list(r_internships_col.find({"$text": {"$search": question}}).limit(3))
    except Exception:
        pass

    # Do not return direct external source URLs to users
    sources = []

    user_id = current_user["sub"]
    conversation_id = payload.conversation_id or user_id
    warning: Optional[str] = None

    # Fetch user document from MongoDB to get actual profile details and name
    user_doc = get_user_by_token(current_user) or {}
    user_profile = user_doc.get("profile") or {}
    user_name = user_doc.get("name", "Student")

    # Fetch DB statistics to help the AI answer general counts
    db_stats = {
        "total_internships": r_internships_col.count_documents({}),
        "total_scholarships": r_scholarships_col.count_documents({}),
    }
    
    # Check user requirements/profile to calculate profile-matched statistics
    target_country = user_profile.get("target_country") or user_profile.get("country")
    major = user_profile.get("major") or user_profile.get("current_field")
    degree = user_profile.get("degree")

    if target_country or major:
        int_filter = {}
        if target_country:
            int_filter["location"] = {"$regex": target_country, "$options": "i"}
        if major:
            int_filter["field"] = {"$regex": major, "$options": "i"}
        try:
            db_stats["matching_internships"] = r_internships_col.count_documents(int_filter)
        except Exception:
            db_stats["matching_internships"] = 0

    if target_country or degree:
        sch_filter = {}
        if target_country:
            sch_filter["country"] = {"$regex": target_country, "$options": "i"}
        if degree:
            sch_filter["$or"] = [
                {"degree_level": {"$regex": degree, "$options": "i"}},
                {"eligibility": {"$regex": degree, "$options": "i"}}
            ]
        try:
            db_stats["matching_scholarships"] = r_scholarships_col.count_documents(sch_filter)
        except Exception:
            db_stats["matching_scholarships"] = 0

    try:
        answer = _generate_answer(question, history, contexts, payload.bot_type, db_scholarships, db_internships, db_stats, user_profile, user_name)
    except Exception as e:
        print(f"[ChatError] Language model call failed: {e}")
        # Build smart fallback response using local DB records
        parts = []
        parts.append(f"Hello {user_name}! The AI assistant cannot reach the language model right now because the API key in the environment is invalid or blocked (verify your API key in `backend/.env`).")
        parts.append("\nHowever, I ran a direct database query and found these matching opportunities for your question:")
        
        has_results = False
        if db_scholarships:
            has_results = True
            parts.append("\n🎓 **Scholarships:**")
            for s in db_scholarships:
                parts.append(f"- **{s.get('title')}** ({s.get('country', 'International')}) - [Apply / Details]({s.get('apply_url') or s.get('source_url')})")
                
        if db_internships:
            has_results = True
            parts.append("\n💼 **Internships:**")
            for i in db_internships:
                wtype = (i.get('workplace_type') or 'onsite').upper()
                stipend_str = f"({i.get('stipend_currency')} {i.get('stipend')}/mo)" if i.get('has_stipend') else "Unpaid"
                parts.append(f"- **{i.get('title')}** at {i.get('company')} ({i.get('location') or wtype}) - {stipend_str} - [Apply / Details]({i.get('apply_url')})")
                
        if not has_results:
            parts.append(f"\nNo direct matches were found in the database. Please try searching with a different keyword like 'Germany', 'funded', or 'Engineering'.")
            
        answer = "\n".join(parts)
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
        m["sources"] = []
    return msgs

# ═══════════════════════════════════════════════════════
# NEWS  (MongoDB-backed RSS feed articles)
# ═══════════════════════════════════════════════════════

@app.get("/news")
def get_news(limit: int = 20, skip: int = 0, tag: Optional[str] = None):
    """
    Return news articles scraped from RSS feeds, stored in MongoDB.
    Sorted by published_at descending (newest first).
    Falls back to ChromaDB-derived snippets if no news articles in DB yet.
    """
    if r_news_col is not None:
        try:
            query_filter: Dict = {}
            if tag:
                query_filter["tag"] = tag
            docs = list(
                r_news_col.find(query_filter)
                .sort("published_at", DESCENDING)
                .skip(skip)
                .limit(limit)
            )
            if docs:
                news = []
                for i, d in enumerate(docs):
                    news.append({
                        "id":           str(d.get("_id", i)),
                        "title":        d.get("title", ""),
                        "summary":      d.get("summary", ""),
                        "url":          d.get("url", ""),
                        "source":       d.get("source", ""),
                        "tag":          d.get("tag", "News"),
                        "favicon":      d.get("favicon", "📰"),
                        "published_at": d["published_at"].isoformat() if isinstance(d.get("published_at"), datetime) else str(d.get("published_at", "")),
                        "scraped_at":   d["scraped_at"].isoformat() if isinstance(d.get("scraped_at"), datetime) else str(d.get("scraped_at", "")),
                    })
                total = r_news_col.count_documents(query_filter)
                return {"news": news, "total": total, "source": "mongodb"}
        except Exception as e:
            print(f"[/news] MongoDB fetch error: {e}")

    # Fallback: derive news snippets from ChromaDB / in-memory vector store
    results = vector_store.query("scholarship internship deadline grant", top_k=limit)
    news = [
        {
            "id":         str(i + 1),
            "title":      r["text"].split("\n")[0][:120],
            "summary":    r["text"][:250].replace("\n", " "),
            "url":        r["url"],
            "source":     r.get("source_domain", ""),
            "tag":        "Scraped",
            "favicon":    "📰",
            "published_at": r.get("scraped_at", ""),
            "scraped_at": r.get("scraped_at", ""),
        }
        for i, r in enumerate(results)
    ]
    return {"news": news, "total": len(news), "source": "chromadb"}


@app.post("/news/scrape")
def trigger_news_scrape(current_user: dict = Depends(get_current_user)):
    """Manually trigger the news RSS scraper (admin use)."""
    stats = run_news_scrape_job()
    return {"status": "done", **stats}


@app.post("/news/cleanup")
def trigger_news_cleanup(current_user: dict = Depends(get_current_user)):
    """Manually delete news articles older than 30 days (admin use)."""
    stats = run_news_cleanup_job()
    return {"status": "done", **stats}


@app.get("/guides/degree-attestation")
def get_degree_attestation_guide():
    return degree_attestation_guide()


@app.get("/recommendations/matches")
def recommendations_matches(
    limit: int = 100,
    # ── Internship-specific filter params ──
    workplace_type: Optional[str] = None,    # "remote" | "hybrid" | "onsite"
    country: Optional[str] = None,           # e.g. "Germany"
    city: Optional[str] = None,              # e.g. "Berlin"
    is_paid: Optional[bool] = None,          # true | false
    has_stipend: Optional[bool] = None,      # true | false
    duration_min: Optional[int] = None,      # minimum weeks
    duration_max: Optional[int] = None,      # maximum weeks
    field: Optional[str] = None,             # e.g. "Computer Science / IT"
    current_user: dict = Depends(get_current_user),
):
    user = r_users_col.find_one({"_id": _safe_user_id(current_user["sub"])})
    if not user:
        raise HTTPException(404, "User not found")
    profile = user.get("profile") or {}
    now = datetime.utcnow()

    # ── Build scholarship query (no extra filters here) ──
    sch_q: dict = {"deadline": {"$gte": now}}
    scholarships = list(
        r_scholarships_col.find(sch_q).sort("deadline", 1).limit(100)
    )

    # ── Build internship query with server-side filtering ──
    and_clauses = [{"deadline": {"$gte": now}}]

    if workplace_type:
        wt_list = [wt.lower().strip() for wt in workplace_type.split(",") if wt.strip()]
        if wt_list:
            and_clauses.append({"workplace_type": {"$in": wt_list}})

    if country:
        c_list = [c.strip() for c in country.split(",") if c.strip()]
        if c_list:
            has_remote = any(c.lower() == "remote" for c in c_list)
            other_countries = [c for c in c_list if c.lower() != "remote"]
            
            or_clauses = []
            if has_remote:
                or_clauses.append({"workplace_type": "remote"})
            for c in other_countries:
                or_clauses.append({"country": {"$regex": f"^{re.escape(c)}$", "$options": "i"}})
            
            if or_clauses:
                if len(or_clauses) == 1:
                    and_clauses.append(or_clauses[0])
                else:
                    and_clauses.append({"$or": or_clauses})

    if city:
        city_list = [c.strip() for c in city.split(",") if c.strip()]
        if city_list:
            or_clauses = []
            for c in city_list:
                or_clauses.append({"city": {"$regex": f"^{re.escape(c)}$", "$options": "i"}})
            if or_clauses:
                if len(or_clauses) == 1:
                    and_clauses.append(or_clauses[0])
                else:
                    and_clauses.append({"$or": or_clauses})

    if is_paid is not None:
        and_clauses.append({"is_paid": is_paid})

    if has_stipend is not None:
        and_clauses.append({"has_stipend": has_stipend})

    if duration_min is not None or duration_max is not None:
        dur_clause: dict = {}
        if duration_min is not None:
            dur_clause["$gte"] = duration_min
        if duration_max is not None:
            dur_clause["$lte"] = duration_max
        and_clauses.append({"duration_weeks": dur_clause})

    if field:
        field_list = [f.strip() for f in field.split(",") if f.strip()]
        if field_list:
            or_clauses = []
            for f in field_list:
                or_clauses.append({"field": {"$regex": f"^{re.escape(f)}$", "$options": "i"}})
            if or_clauses:
                if len(or_clauses) == 1:
                    and_clauses.append(or_clauses[0])
                else:
                    and_clauses.append({"$or": or_clauses})

    int_q = {"$and": and_clauses} if len(and_clauses) > 1 else and_clauses[0]

    internships = list(
        r_internships_col.find(int_q).sort("deadline", 1).limit(200)
    )

    # ── Rank by profile relevance ──
    ranked_s = sorted(
        scholarships,
        key=lambda d: _score_doc_for_profile(d, profile, "scholarship"),
        reverse=True,
    )
    ranked_i = sorted(
        internships,
        key=lambda d: _score_doc_for_profile(d, profile, "internship"),
        reverse=True,
    )[:limit]

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
        {"_id": {"$ne": _safe_user_id(me)}, "$or": [{"handle": rx}, {"name": rx}]},
        {"name": 1, "handle": 1, "user_type": 1, "avatar": 1},
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
    u = r_users_col.find_one({"_id": _safe_user_id(uid)})
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
    u = r_users_col.find_one({"_id": _safe_user_id(uid)})
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


# DEBUG: Temporary endpoint to inspect applications for a job (dev only)
@app.get("/debug/applications/{job_id}")
def debug_applications_for_job(job_id: str):
    """Return applications documents for a given job_id for debugging purposes.
    NOT FOR PRODUCTION — remove when debugging is complete.
    """
    try:
        docs = list(applications_col.find({"item_type": "job_posting", "item_id": job_id}).sort("created_at", DESCENDING).limit(50))
    except Exception as e:
        raise HTTPException(500, f"DB query failed: {e}")
    out = []
    for d in docs:
        d = _serialize(d)
        # redact large fields
        if d and "cv_extracted_text" in d:
            d["cv_extracted_text"] = (d["cv_extracted_text"] or "")[:200]
        out.append(d)
    return {"count": len(out), "applications": out}


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

    applicant = r_users_col.find_one({"_id": _safe_user_id(current_user["sub"])})
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

    try:
        analysis = analyze_cv_against_job(extracted_text, job) or {}
        if not isinstance(analysis, dict):
            analysis = {}
    except Exception as exc:
        # If analysis fails, don't block the application — record minimal analysis info
        analysis = {"score": 0, "status": "Analysis Failed", "issues": [str(exc)]}

    minimum_score = job.get("minimum_cv_score") if isinstance(job.get("minimum_cv_score"), int) else 45
    show_to_recruiter = bool(analysis.get("show_to_recruiter", True))
    if job.get("auto_hide_irrelevant_cvs", True) and (analysis.get("score", 0) or 0) < minimum_score:
        show_to_recruiter = False

    review_status = "auto_shortlisted"
    analysis_status = (analysis.get("status") or "").strip()
    if analysis_status == "Needs Manual Review":
        review_status = "needs_review"
    elif analysis_status == "Irrelevant or Unusual CV":
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
    except DuplicateKeyError:
        raise HTTPException(409, "Application already exists for this job")
    except Exception as exc:
        raise HTTPException(500, f"Application creation failed: {exc}")

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
    try:
        uid = current_user["sub"]
        u = r_users_col.find_one({"_id": _safe_user_id(uid)})
        if not u or u.get("user_type") != "recruiter" or u.get("status") != "approved":
            raise HTTPException(403, "Approved recruiter accounts only")
        oid = _parse_object_id(job_id, "job_id")
        job = job_postings_col.find_one({"_id": oid})
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

        # Read from primary to avoid read-replica lag
        apps = list(applications_col.find(query).sort([("cv_score", DESCENDING), ("created_at", DESCENDING)]))
        out: List[dict] = []
        for a in apps:
            a["_id"] = str(a["_id"])
            _serialize(a)
            # handle user_id stored as string or ObjectId
            try:
                applicant_oid = ObjectId(a.get("user_id")) if not isinstance(a.get("user_id"), ObjectId) else a.get("user_id")
            except Exception:
                applicant_oid = a.get("user_id")
            applicant = r_users_col.find_one(
                {"_id": applicant_oid},
                {"password": 0},
            )
            if applicant:
                applicant["_id"] = str(applicant["_id"])
            out.append({**a, "applicant": applicant})
        return {"applications": out}
    except HTTPException:
        raise
    except Exception as exc:
        import traceback, sys
        traceback.print_exc(file=sys.stdout)
        raise HTTPException(500, f"Recruiter applications error: {exc}")


@app.put("/recruiter/applications/{application_id}/review")
def recruiter_review_application(
    application_id: str,
    data: ApplicationReviewRequest,
    current_user: dict = Depends(get_current_user),
):
    uid = current_user["sub"]
    u = r_users_col.find_one({"_id": _safe_user_id(uid)})
    if not u or u.get("user_type") != "recruiter" or u.get("status") != "approved":
        raise HTTPException(403, "Approved recruiter accounts only")

    oid = _parse_object_id(application_id, "application_id")
    # Read/write recruiter actions should operate on the primary
    # `applications` collection to avoid replica lag and allow updates.
    application = applications_col.find_one({"_id": oid})
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
    applications_col.update_one({"_id": oid}, {"$set": update_doc})
    return {"status": "updated"}


@app.get("/recruiter/dashboard")
def recruiter_dashboard(current_user: dict = Depends(get_current_user)):
    uid = current_user["sub"]
    u = r_users_col.find_one({"_id": _safe_user_id(uid)})
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
            "banner":    user.get("banner"),
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
    user = r_users_col.find_one({"_id": _safe_user_id(user_id)})
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
    if data.banner is not None:
        bn = (data.banner or "").strip()
        if bn.startswith("http") and CLOUDINARY_CONFIGURED and not _allowed_image_url(bn):
            raise HTTPException(400, "Banner photo must use an image uploaded through SCHLR")
        raw_update["banner"] = bn or None
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
        existing = users_col.find_one({"_id": _safe_user_id(user_id)}, {"profile": 1}) or {}
        current_profile = existing.get("profile") or {}
        filtered = {k: v for k, v in data.profile.items() if k in allowed_profile_keys}
        raw_update["profile"] = {**current_profile, **filtered}

    safe_update = _strip_immutable(raw_update, _USER_IMMUTABLE_FIELDS)
    users_col.update_one({"_id": _safe_user_id(user_id)}, {"$set": safe_update})
    return {"status": "updated"}


@app.delete("/users/{user_id}")
def delete_user(user_id: str, current_user: dict = Depends(get_current_user)):
    if current_user["sub"] != user_id:
        raise HTTPException(403, "Cannot delete another user's account")

    # FIX: Cascade delete to prevent orphaned documents
    posts_col.delete_many({"user_id": user_id})
    job_postings_col.delete_many({"recruiter_id": user_id})
    messages_col.delete_many({"user_id": user_id})
    dm_messages_col.delete_many({"$or": [{"sender_id": user_id}, {"recipient_id": user_id}]})
    dm_threads_col.delete_many({"participants": user_id})
    applications_col.delete_many({"user_id": user_id})
    connections_col.delete_many({"$or": [{"user1_id": user_id}, {"user2_id": user_id}]})
    notifications_col.delete_many({"$or": [{"user_id": user_id}, {"sender_id": user_id}]})
    # Remove from other users' followers/following lists
    users_col.update_many({}, {"$pull": {"followers": user_id, "following": user_id}})
    # Remove from saved_posts on posts
    posts_col.update_many({}, {"$pull": {"saved_by": user_id, "liked_by": user_id}})

    users_col.delete_one({"_id": _safe_user_id(user_id)})
    return {"status": "deleted"}


@app.post("/users/{user_id}/change-password")
def change_password(
    user_id: str,
    data: ChangePasswordRequest,
    current_user: dict = Depends(get_current_user),
):
    if current_user["sub"] != user_id:
        raise HTTPException(403, "Cannot change another user's password")

    if user_id == SUPER_ADMIN_ID:
        global ADMIN_PASSWORD
        if data.old_password != ADMIN_PASSWORD:
            raise HTTPException(400, "Incorrect current password")

        if not _is_strong_password(data.new_password):
            raise HTTPException(
                400,
                "New password must be at least 8 characters and include uppercase, lowercase, number, and special character"
            )

        ADMIN_PASSWORD = data.new_password
        return {"status": "password_changed"}

    user = users_col.find_one({"_id": _safe_user_id(user_id)})
    if not user:
        raise HTTPException(404, "User not found")

    if not verify_password(data.old_password, user["password"]):
        raise HTTPException(400, "Incorrect current password")

    if not _is_strong_password(data.new_password):
        raise HTTPException(
            400,
            "New password must be at least 8 characters and include uppercase, lowercase, number, and special character"
        )

    users_col.update_one(
        {"_id": _safe_user_id(user_id)},
        {"$set": {"password": hash_password(data.new_password), "updated_at": datetime.utcnow()}}
    )
    return {"status": "password_changed"}


@app.post("/users/{user_id}/follow")
def follow_user(user_id: str, current_user: dict = Depends(get_current_user)):
    me_id = current_user["sub"]
    if me_id == user_id:
        raise HTTPException(400, "Cannot follow yourself")

    target = r_users_col.find_one({"_id": _safe_user_id(user_id)})
    if not target:
        raise HTTPException(404, "User not found")

    already_following = me_id in target.get("followers", [])

    if already_following:
        users_col.update_one({"_id": _safe_user_id(user_id)}, {"$pull":     {"followers": me_id}})
        users_col.update_one({"_id": _safe_user_id(me_id)},   {"$pull":     {"following": user_id}})
        return {"status": "unfollowed"}
    else:
        users_col.update_one({"_id": _safe_user_id(user_id)}, {"$addToSet": {"followers": me_id}})
        users_col.update_one({"_id": _safe_user_id(me_id)},   {"$addToSet": {"following": user_id}})
        return {"status": "followed"}


@app.get("/users/{user_id}/saved-posts")
def saved_posts(user_id: str, current_user: dict = Depends(get_current_user)):
    if current_user["sub"] != user_id:
        raise HTTPException(403, "Cannot view another user's saved posts")
    user = r_users_col.find_one({"_id": _safe_user_id(user_id)}, {"saved_posts": 1})
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
        {"_id": _safe_user_id(user_id)}, {"name": 1, "handle": 1, "user_type": 1, "avatar": 1}
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

    editor = r_users_col.find_one({"_id": _safe_user_id(current_user["sub"])}, {"user_type": 1}) or {}

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
        {"_id": _safe_user_id(user_id)}, {"name": 1, "handle": 1, "avatar": 1}
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

    user  = users_col.find_one({"_id": _safe_user_id(user_id)}, {"saved_posts": 1})
    saved = (user or {}).get("saved_posts", [])

    if post_id in saved:
        users_col.update_one({"_id": _safe_user_id(user_id)}, {"$pull":     {"saved_posts": post_id}})
        posts_col.update_one( {"_id": ObjectId(post_id)},{"$pull":     {"saved_by": user_id}})
        return {"status": "unsaved"}
    else:
        users_col.update_one({"_id": _safe_user_id(user_id)}, {"$addToSet": {"saved_posts": post_id}})
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

@app.get("/news/scholarships")
def get_news_scholarships(limit: int = 10):
    query = {"scraped_at": {"$ne": None}}
    docs = list(r_scholarships_col.find(query).sort("created_at", -1).limit(limit))
    for d in docs:
        d["_id"] = str(d["_id"])
        _serialize(d)
    return {"scholarships": docs}


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
        "country": data.country,
        "city": data.city,
        "workplace_type": (data.workplace_type or "onsite").lower(),
        "is_paid": data.is_paid,
        "has_stipend": data.has_stipend,
        "stipend": data.stipend,
        "stipend_currency": data.stipend_currency or "USD",
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
        "country": data.country,
        "city": data.city,
        "workplace_type": (data.workplace_type or "onsite").lower(),
        "is_paid": data.is_paid,
        "has_stipend": data.has_stipend,
        "stipend": data.stipend,
        "stipend_currency": data.stipend_currency or "USD",
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

    applicant = r_users_col.find_one({"_id": _safe_user_id(current_user["sub"])})
    if not applicant:
        raise HTTPException(404, "User not found")

    item_oid = _parse_object_id(data.item_id, "item_id")
    exists = None
    if data.item_type == "scholarship":
        exists = r_scholarships_col.find_one({"_id": item_oid})
        if not exists and r_news_col is not None:
            exists = r_news_col.find_one({"_id": item_oid})
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
    except DuplicateKeyError:
        raise HTTPException(409, "Application already exists for this item")
    except Exception as exc:
        raise HTTPException(500, f"Application creation failed: {exc}")
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
        item_id = d.get("item_id")
        i_type = d.get("item_type")
        details = None
        try:
            if i_type == "scholarship":
                details = r_scholarships_col.find_one({"_id": ObjectId(item_id)})
                if not details and r_news_col is not None:
                    details = r_news_col.find_one({"_id": ObjectId(item_id)})
                    if details:
                        details["university"] = details.get("source_name") or "News Alert"
                        details["country"] = "Global"
                        details["eligibility"] = details.get("snippet") or details.get("description") or ""
                        details["apply_url"] = details.get("url") or details.get("link") or ""
            elif i_type == "internship":
                details = r_internships_col.find_one({"_id": ObjectId(item_id)})
            elif i_type == "job_posting":
                details = r_job_postings_col.find_one({"_id": ObjectId(item_id)})
            if details:
                details["_id"] = str(details["_id"])
                _serialize(details)
        except Exception:
            pass
        d["item_details"] = details
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
            applicant = r_users_col.find_one({"_id": _safe_user_id(current_user["sub"])}, {"profile": 1})
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
        _populate_thread_users(t, user_id)
    return threads


@app.post("/dm/threads")
def create_or_get_thread(
    data: DMThreadRequest,
    current_user: dict = Depends(get_current_user),
):
    me_id = current_user["sub"]

    recipients = []
    if data.recipient_ids:
        recipients = list(data.recipient_ids)
    elif data.recipient_id:
        recipients = [data.recipient_id]

    participants = list(set([me_id] + recipients))

    thread_id = _get_thread_id_multiple(participants)
    existing  = r_dm_threads_col.find_one({"thread_id": thread_id})

    if existing:
        existing["_id"] = str(existing["_id"])
        _populate_thread_users(existing, me_id)
        return existing

    thread = {
        "thread_id":    thread_id,
        "participants": participants,
        "created_at":   datetime.utcnow(),
        "updated_at":   datetime.utcnow(),
    }
    result = dm_threads_col.insert_one(thread)
    thread["_id"] = str(result.inserted_id)
    _populate_thread_users(thread, me_id)
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

    user_doc = r_users_col.find_one({"_id": _safe_user_id(user_id)}, {"name": 1})
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


@app.delete("/dm/messages/{message_id}")
async def delete_dm_message(message_id: str, current_user: dict = Depends(get_current_user)):
    user_id = current_user["sub"]
    oid = _parse_object_id(message_id, "message_id")
    msg = r_dm_messages_col.find_one({"_id": oid})
    if not msg:
        raise HTTPException(404, "Message not found")
    if msg.get("sender_id") != user_id:
        raise HTTPException(403, "Cannot delete another user's message")

    thread_id = msg.get("thread_id")
    dm_messages_col.delete_one({"_id": oid})

    # Broadcast deletion to other participants via WebSocket
    thread = r_dm_threads_col.find_one({"thread_id": thread_id})
    if thread:
        for p in thread["participants"]:
            if p != user_id:
                await manager.send_to_user(p, {
                    "type": "message_deleted",
                    "message_id": message_id,
                    "thread_id": thread_id
                })

    return {"status": "deleted"}


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
    try:
        user_threads = list(r_dm_threads_col.find({"participants": user_id}))
        notified_users = set()
        for t in user_threads:
            for p in t["participants"]:
                if p != user_id:
                    notified_users.add(p)
        for p in notified_users:
            await manager.send_to_user(p, {
                "type": "user_status",
                "user_id": user_id,
                "status": "online"
            })
    except Exception as e:
        print(f"Error broadcasting online status: {e}")
    user_doc = r_users_col.find_one({"_id": _safe_user_id(user_id)}, {"name": 1, "handle": 1})

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

                for p in thread["participants"]:
                    if p != user_id:
                        await manager.send_to_user(p, {"type": "message", **msg_doc})
                await websocket.send_json({"type": "message_sent", **msg_doc})

            elif msg_type == "typing":
                thread_id    = data.get("thread_id", "")
                thread = r_dm_threads_col.find_one({"thread_id": thread_id})
                if thread and user_id in thread["participants"]:
                    for p in thread["participants"]:
                        if p != user_id:
                            await manager.send_to_user(p, {
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
                if thread and user_id in thread["participants"]:
                    for p in thread["participants"]:
                        if p != user_id:
                            await manager.send_to_user(p, {
                                "type":      "read",
                                "thread_id": thread_id,
                                "reader_id": user_id,
                            })

    except WebSocketDisconnect:
        manager.disconnect(websocket, user_id)
        if not manager.is_online(user_id):
            try:
                user_threads = list(r_dm_threads_col.find({"participants": user_id}))
                notified_users = set()
                for t in user_threads:
                    for p in t["participants"]:
                        if p != user_id:
                            notified_users.add(p)
                for p in notified_users:
                    await manager.send_to_user(p, {
                        "type": "user_status",
                        "user_id": user_id,
                        "status": "offline"
                    })
            except Exception as e:
                print(f"Error broadcasting offline status: {e}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)