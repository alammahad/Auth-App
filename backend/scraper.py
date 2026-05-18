from datetime import datetime
from typing import List, Dict

class WebScraper:
    def __init__(self):
        self._last_scraped_at = None
        self._urls_scraped = []

    def scrape_urls(self, urls: List[str]) -> List[Dict]:
        self._last_scraped_at = datetime.utcnow().isoformat() + "Z"
        self._urls_scraped = list(urls)
        # Minimal stub: return no chunks so app startup still works.
        return []

    def incremental_status(self) -> Dict:
        return {
            "last_scraped_at": self._last_scraped_at,
            "urls_scraped": self._urls_scraped,
            "status": "idle",
        }
