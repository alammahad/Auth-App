"""
News scraper for ScholarAI.

Fetches headline-level education/scholarship news from free RSS feeds.
Deduplicates by URL hash and upserts into MongoDB `news_articles` collection.

Scheduled daily at 2:05 AM via APScheduler.
"""
from __future__ import annotations

import hashlib
import re
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional
from email.utils import parsedate_to_datetime

# feedparser is a lightweight RSS/Atom parser — no API key required
try:
    import feedparser
    _FEEDPARSER_AVAILABLE = True
except ImportError:
    _FEEDPARSER_AVAILABLE = False
    print("[NewsScraper] feedparser not installed — news scraping will be skipped.")

# ═══════════════════════════════════════════════════════
# SOURCE LIST — free education/scholarship RSS feeds
# ═══════════════════════════════════════════════════════

NEWS_RSS_FEEDS: List[Dict[str, str]] = [
    {
        "url": "https://www.timeshighereducation.com/student/rss.xml",
        "source": "Times Higher Education",
        "tag": "Higher Education",
        "favicon": "🎓",
    },
    {
        "url": "https://www.studyinternational.com/feed/",
        "source": "Study International",
        "tag": "Scholarships",
        "favicon": "🌏",
    },
    {
        "url": "https://scholars4dev.com/feed/",
        "source": "Scholars4Dev",
        "tag": "Fully Funded",
        "favicon": "💡",
    },
    {
        "url": "https://www.opportunitydesk.org/feed/",
        "source": "Opportunity Desk",
        "tag": "Opportunities",
        "favicon": "🚀",
    },
    {
        "url": "https://scholarshipscorner.website/feed/",
        "source": "Scholarships Corner",
        "tag": "Scholarship",
        "favicon": "🏅",
    },
    {
        "url": "https://www.afterschoolafrica.com/feed/",
        "source": "After School Africa",
        "tag": "International",
        "favicon": "🌍",
    },
    {
        "url": "https://www.masterstudies.com/articles/rss",
        "source": "MasterStudies",
        "tag": "Masters",
        "favicon": "📚",
    },
    {
        "url": "https://edvoy.com/articles/feed",
        "source": "Edvoy",
        "tag": "Study Abroad",
        "favicon": "✈️",
    },
    {
        "url": "https://www.scholarshippositions.com/feed",
        "source": "Scholarship Positions",
        "tag": "Position",
        "favicon": "📋",
    },
    {
        "url": "https://www.findamasters.com/rss/news.aspx",
        "source": "FindAMasters",
        "tag": "Masters",
        "favicon": "🎯",
    },
]

# ═══════════════════════════════════════════════════════
# HELPERS
# ═══════════════════════════════════════════════════════

def _url_hash(url: str) -> str:
    """Short unique key derived from URL."""
    return hashlib.sha256(url.encode("utf-8", "ignore")).hexdigest()[:24]


def _clean_html(raw: str) -> str:
    """Strip HTML tags from a string."""
    if not raw:
        return ""
    clean = re.sub(r"<[^>]+>", " ", raw)
    clean = re.sub(r"\s+", " ", clean).strip()
    return clean[:600]


def _parse_published(entry) -> datetime:
    """Try to extract a publish datetime from an RSS entry."""
    # feedparser provides `published_parsed` as a time.struct_time in UTC
    try:
        if hasattr(entry, "published_parsed") and entry.published_parsed:
            import time
            return datetime(*entry.published_parsed[:6], tzinfo=timezone.utc).replace(tzinfo=None)
    except Exception:
        pass
    try:
        if hasattr(entry, "published") and entry.published:
            return parsedate_to_datetime(entry.published).replace(tzinfo=None)
    except Exception:
        pass
    return datetime.utcnow()


def _entry_url(entry) -> str:
    """Best URL from a feed entry."""
    return (
        getattr(entry, "link", None)
        or getattr(entry, "id", None)
        or ""
    ).strip()


def _entry_summary(entry) -> str:
    """Best summary/description from a feed entry."""
    summary = (
        getattr(entry, "summary", None)
        or getattr(entry, "description", None)
        or ""
    )
    return _clean_html(summary)

# ═══════════════════════════════════════════════════════
# CORE FETCH
# ═══════════════════════════════════════════════════════

def fetch_news_from_feed(feed_meta: Dict[str, str], max_items: int = 15) -> List[Dict[str, Any]]:
    """
    Parse one RSS feed and return a list of article dicts.
    Returns [] on any error so callers can continue to next feed.
    """
    if not _FEEDPARSER_AVAILABLE:
        return []

    url = feed_meta["url"]
    source = feed_meta.get("source", "Unknown")
    tag = feed_meta.get("tag", "News")
    favicon = feed_meta.get("favicon", "📰")

    try:
        parsed = feedparser.parse(url, agent="ScholarAI/1.0 (+https://github.com/scholarpak)")
        # feedparser sets bozo=True for slightly malformed feeds but still extracts entries.
        # Only bail out if we got zero entries AND there was a hard error.
        if not parsed.entries:
            err = parsed.get("bozo_exception")
            if err:
                print(f"[NewsScraper] {source}: no entries, error={err}")
            return []
    except Exception as e:
        print(f"[NewsScraper] Network error fetching {source}: {e}")
        return []

    items: List[Dict[str, Any]] = []
    for entry in parsed.entries[:max_items]:
        link = _entry_url(entry)
        if not link:
            continue

        title = _clean_html(getattr(entry, "title", "") or "")
        if not title:
            continue

        summary = _entry_summary(entry)
        published_at = _parse_published(entry)
        url_hash = _url_hash(link)

        items.append(
            {
                "url_hash": url_hash,
                "title": title,
                "summary": summary,
                "url": link,
                "source": source,
                "tag": tag,
                "favicon": favicon,
                "published_at": published_at,
                "scraped_at": datetime.utcnow(),
            }
        )

    print(f"[NewsScraper] {source}: {len(items)} articles fetched.")
    return items


# ═══════════════════════════════════════════════════════
# CLEANUP JOB — removes articles older than 30 days
# ═══════════════════════════════════════════════════════

NEWS_RETENTION_DAYS = 30  # articles older than this are deleted


def cleanup_old_news(news_col) -> Dict[str, int]:
    """
    Delete news articles whose `published_at` is older than NEWS_RETENTION_DAYS (30 days).

    Scheduled daily at 2:10 AM — runs right after the RSS scrape job.

    Args:
        news_col: pymongo Collection handle for `news_articles`.

    Returns:
        dict with deleted count and remaining total.
    """
    if news_col is None:
        print("[NewsScraper] cleanup_old_news: MongoDB not available.")
        return {"deleted": 0, "remaining": 0}

    cutoff = datetime.utcnow() - timedelta(days=NEWS_RETENTION_DAYS)
    try:
        result = news_col.delete_many({"published_at": {"$lt": cutoff}})
        remaining = news_col.count_documents({})
        print(
            f"[NewsScraper] Cleanup done — deleted={result.deleted_count} "
            f"articles older than {NEWS_RETENTION_DAYS} days, remaining={remaining}"
        )
        return {"deleted": result.deleted_count, "remaining": remaining}
    except Exception as e:
        print(f"[NewsScraper] Cleanup error: {e}")
        return {"deleted": 0, "remaining": 0}


# ═══════════════════════════════════════════════════════
# MAIN JOB — called by APScheduler
# ═══════════════════════════════════════════════════════

def run_news_scrape(news_col) -> Dict[str, int]:
    """
    Scrape all RSS feeds and upsert results into MongoDB `news_articles`.
    After scraping, automatically removes articles older than 30 days.

    Args:
        news_col: pymongo Collection handle for `news_articles`.

    Returns:
        dict with upserted, skipped, total, deleted counts.
    """
    if news_col is None:
        print("[NewsScraper] MongoDB not available — skipping.")
        return {"upserted": 0, "skipped": 0, "total": 0, "deleted": 0}

    if not _FEEDPARSER_AVAILABLE:
        print("[NewsScraper] feedparser not installed — cannot run.")
        return {"upserted": 0, "skipped": 0, "total": 0, "deleted": 0}

    all_articles: List[Dict[str, Any]] = []
    for feed_meta in NEWS_RSS_FEEDS:
        articles = fetch_news_from_feed(feed_meta)
        all_articles.extend(articles)

    if not all_articles:
        print("[NewsScraper] No articles fetched from any feed.")
        return {"upserted": 0, "skipped": 0, "total": 0, "deleted": 0}

    upserted = 0
    skipped = 0
    now = datetime.utcnow()

    for article in all_articles:
        try:
            result = news_col.update_one(
                {"url_hash": article["url_hash"]},
                {
                    "$set": {
                        "title": article["title"],
                        "summary": article["summary"],
                        "url": article["url"],
                        "source": article["source"],
                        "tag": article["tag"],
                        "favicon": article["favicon"],
                        "published_at": article["published_at"],
                        "scraped_at": now,
                    },
                    "$setOnInsert": {
                        "url_hash": article["url_hash"],
                        "created_at": now,
                    },
                },
                upsert=True,
            )
            if result.upserted_id or result.modified_count:
                upserted += 1
            else:
                skipped += 1
        except Exception as e:
            print(f"[NewsScraper] DB upsert error for '{article.get('title', '?')}': {e}")
            skipped += 1

    # Auto-cleanup: remove articles older than 30 days after every scrape
    cleanup_stats = cleanup_old_news(news_col)

    total = news_col.count_documents({})
    print(f"[NewsScraper] Done — upserted={upserted}, skipped={skipped}, total_in_db={total}")
    return {
        "upserted": upserted,
        "skipped": skipped,
        "total": total,
        "deleted_old": cleanup_stats["deleted"],
    }
