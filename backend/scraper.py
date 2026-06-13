import httpx
from bs4 import BeautifulSoup
from datetime import datetime
from typing import List, Dict
import urllib.parse

class WebScraper:
    def __init__(self):
        self._last_scraped_at = None
        self._urls_scraped = []

    def scrape_urls(self, urls: List[str]) -> List[Dict]:
        self._last_scraped_at = datetime.utcnow().isoformat() + "Z"
        self._urls_scraped = list(urls)
        
        chunks = []
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36"
        }
        
        # Disable SSL verification (verify=False) for slow university/govt domains and follow redirects
        with httpx.Client(headers=headers, timeout=10.0, follow_redirects=True, verify=False) as client:
            for url in urls:
                try:
                    r = client.get(url)
                    if r.status_code != 200:
                        continue
                    
                    soup = BeautifulSoup(r.text, 'html.parser')
                    
                    # Extract page title before removing header tags
                    page_title = soup.title.string.strip() if soup.title else ""
                    
                    # Remove non-content elements to extract clean information
                    for element in soup(["script", "style", "nav", "header", "footer", "aside", "form", "iframe", "noscript"]):
                        element.extract()
                        
                    # Extract text and clean up whitespaces
                    text = soup.get_text(separator=" ")
                    lines = (line.strip() for line in text.splitlines())
                    chunks_text = (phrase.strip() for line in lines for phrase in line.split("  "))
                    cleaned_text = " ".join(chunk for chunk in chunks_text if chunk)
                    
                    if len(cleaned_text) < 200:
                        continue
                        
                    source_domain = urllib.parse.urlparse(url).netloc
                    scraped_at = datetime.utcnow()
                    
                    # 1000 char chunk size with 200 char overlap
                    chunk_size = 1000
                    overlap = 200
                    start = 0
                    while start < len(cleaned_text):
                        end = min(start + chunk_size, len(cleaned_text))
                        chunk_payload = cleaned_text[start:end]
                        chunks.append({
                            "text": chunk_payload,
                            "url": url,
                            "source_domain": source_domain,
                            "scraped_at": scraped_at,
                            "title": page_title
                        })
                        start += chunk_size - overlap
                        
                except Exception as e:
                    print(f"Error scraping {url}: {e}")
                    continue
                    
        return chunks

    def incremental_status(self) -> Dict:
        return {
            "last_scraped_at": self._last_scraped_at,
            "urls_scraped": self._urls_scraped,
            "status": "idle",
        }

