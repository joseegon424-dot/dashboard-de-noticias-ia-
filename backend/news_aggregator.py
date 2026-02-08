import modal
import feedparser
import requests
from bs4 import BeautifulSoup
import datetime
import time
import hashlib
import re

app = modal.App("ai-pulse-news")

# Define image with dependencies
image = modal.Image.debian_slim().pip_install("feedparser", "beautifulsoup4", "requests", "fastapi[standard]")

# Persistent storage for news
news_storage = modal.Dict.from_name("ai-news-storage", create_if_missing=True)

# ─── Configuration ───

SOURCES = [
    {"id": "rundown", "name": "The Rundown AI", "type": "html", "url": "https://www.therundown.ai/", "icon": "🏃", "color": "#FF6B35"},
    {"id": "venturebeat", "name": "VentureBeat AI", "type": "rss", "url": "https://venturebeat.com/category/ai/feed/", "icon": "📡", "color": "#4A9EFF"},
    {"id": "ainews", "name": "AI News", "type": "rss", "url": "https://www.artificialintelligence-news.com/feed/", "icon": "🤖", "color": "#00CED1"},
    {"id": "decoder", "name": "The Decoder", "type": "rss", "url": "https://the-decoder.com/feed/", "icon": "🧩", "color": "#A855F7"},
    {"id": "marktechpost", "name": "MarkTechPost", "type": "rss", "url": "https://www.marktechpost.com/feed/", "icon": "📊", "color": "#FF3366"},
    {"id": "bens", "name": "Ben's Bites", "type": "rss", "url": "https://bensbites.substack.com/feed", "icon": "🍪", "color": "#FFD700"},
    {"id": "tldr", "name": "TLDR AI", "type": "html", "url": "https://tldr.tech/ai", "icon": "⚡", "color": "#32CD32"},
    {"id": "techcrunch", "name": "TechCrunch AI", "type": "rss", "url": "https://techcrunch.com/category/artificial-intelligence/feed/", "icon": "💚", "color": "#0A8F00"},
]

CATEGORY_RULES = [
    {"category": "🎬 Video IA", "keywords": ["video", "sora", "runway", "pika", "kling", "luma", "animate", "clip", "footage", "film", "veo", "dreamina"]},
    {"category": "💰 Ganar Dinero", "keywords": ["money", "revenue", "business", "monetiz", "income", "profit", "startup", "enterprise", "saas", "freelanc", "side hustle", "funding", "valuation", "ipo", "acquisition"]},
    {"category": "🤖 Agentes IA", "keywords": ["agent", "agentic", "autonomous", "automat", "workflow", "codex", "claude code", "mcp", "copilot", "orchestrat"]},
    {"category": "🖼️ Imagen IA", "keywords": ["image", "midjourney", "dall-e", "stable diffusion", "flux", "grok imagine", "ideogram", "imagen", "illustration"]},
    {"category": "🧠 Modelos", "keywords": ["model", "gpt", "claude", "gemini", "llama", "mistral", "opus", "sonnet", "o1", "o3", "benchmark", "parameter", "training", "fine-tun", "frontier"]},
    {"category": "🔧 Herramientas", "keywords": ["tool", "app", "plugin", "extension", "chrome", "api", "sdk", "platform", "launch", "release", "feature"]},
    {"category": "🏢 Big Tech", "keywords": ["openai", "google", "meta", "microsoft", "apple", "amazon", "nvidia", "anthropic", "xai", "elon", "altman", "deepmind"]},
    {"category": "🎓 Guías & Tips", "keywords": ["guide", "tutorial", "how to", "step-by-step", "tips", "learn", "training", "prompt", "workflow"]},
    {"category": "🔬 Investigación", "keywords": ["research", "paper", "study", "breakthrough", "discovery", "science", "lab", "arxiv"]},
    {"category": "🤝 Open Source", "keywords": ["open source", "open-source", "github", "hugging face", "local model", "weight", "replicate"]},
]

# ─── Utilities ───

def hash_id(s):
    return "art_" + hashlib.md5(s.encode()).hexdigest()[:10]

def clean_html(html):
    soup = BeautifulSoup(html, "html.parser")
    # Remove unwanted tags
    for tag in soup(["script", "style", "iframe", "nav", "footer", "header", "aside"]):
        tag.decompose()
    return soup.get_text(separator=" ", strip=True)

def detect_categories(text):
    text_lower = text.lower()
    matched = []
    for rule in CATEGORY_RULES:
        for kw in rule["keywords"]:
            if kw in text_lower:
                if rule["category"] not in matched:
                    matched.append(rule["category"])
                break
    return matched if matched else ["📰 General"]

def score_article(article):
    score = 0
    # Recency (0-50 pts)
    try:
        pub_dt = datetime.datetime.fromisoformat(article["publishedAt"].replace("Z", "+00:00"))
        hours_old = (datetime.datetime.now(datetime.timezone.utc) - pub_dt).total_seconds() / 3600
        if hours_old < 24:
            score += 50
        elif hours_old < 48:
            score += 25
    except:
        pass

    # Category Content (0-30 pts)
    # Prefer "Big Tech", "Models", "Tools"
    cats = article.get("categories", [])
    if "🏢 Big Tech" in cats: score += 10
    if "🧠 Modelos" in cats: score += 15
    if "🔧 Herramientas" in cats: score += 5

    # Title Length heuristic (avoid too short/long)
    t_len = len(article["title"])
    if 20 < t_len < 100: score += 5
    
    return score

# ─── Fetchers ───

def fetch_rss(source):
    print(f"Fetching RSS: {source['name']}")
    feed = feedparser.parse(source["url"])
    articles = []
    for entry in feed.entries:
        try:
            title = entry.title
            link = entry.link
            pub_date = datetime.datetime.now(datetime.timezone.utc).isoformat()
            if hasattr(entry, "published_parsed") and entry.published_parsed:
                pub_date = datetime.datetime(*entry.published_parsed[:6], tzinfo=datetime.timezone.utc).isoformat()
            
            content = ""
            if "content" in entry:
                content = entry.content[0].value
            elif "description" in entry:
                content = entry.description

            summary = clean_html(content)[:280] + "..."
            cats = detect_categories(title + " " + summary)

            articles.append({
                "id": hash_id(link),
                "title": title,
                "summary": summary,
                "content": content, # Full HTML for reader
                "source": source["name"],
                "sourceIcon": source["icon"],
                "sourceColor": source["color"],
                "url": link,
                "publishedAt": pub_date,
                "categories": cats,
            })
        except Exception as e:
            print(f"Error parsing entry in {source['name']}: {e}")
            continue
    return articles

def fetch_html_rundown(source):
    print(f"Fetching HTML: {source['name']}")
    try:
        resp = requests.get(source["url"], timeout=10)
        soup = BeautifulSoup(resp.content, "html.parser")
        articles = []
        # Logic adapted from JS parser for Rundown
        # Look for links containing /p/
        links = soup.find_all("a", href=True)
        seen = set()
        
        for link in links:
            href = link["href"]
            if "/p/" not in href: continue
            
            full_url = href if href.startswith("http") else "https://www.therundown.ai" + href
            if full_url in seen: continue
            seen.add(full_url)
            
            title_tag = link.find(["h1", "h2", "h3", "h4"])
            title = title_tag.get_text(strip=True) if title_tag else link.get_text(strip=True)
            if not title or len(title) < 10: continue

            # Remove "PLUS: ..."
            if "PLUS:" in title:
                title = title.split("PLUS:")[0].strip()

            articles.append({
                "id": hash_id(full_url),
                "title": title,
                "summary": "Click to read full summary...",
                "content": "", # Content fetched on-demand in frontend, or could fetch here? For now keep simple
                "source": source["name"],
                "sourceIcon": source["icon"],
                "sourceColor": source["color"],
                "url": full_url,
                "publishedAt": datetime.datetime.now(datetime.timezone.utc).isoformat(),
                "categories": detect_categories(title),
            })
        return articles
    except Exception as e:
        print(f"Error fetching Rundown: {e}")
        return []

def fetch_html_tldr(source):
    print(f"Fetching HTML: {source['name']}")
    try:
        resp = requests.get(source["url"], timeout=10)
        soup = BeautifulSoup(resp.content, "html.parser")
        articles = []
        seen = set()
        
        # TLDR structure is messy, look for links in content
        for a in soup.find_all("a", href=True):
            href = a["href"]
            if not href.startswith("http") or "tldr.tech" in href or href in seen: continue
            seen.add(href)
            
            text = a.get_text(strip=True)
            if len(text) < 15 or len(text) > 200: continue
            
            articles.append({
                "id": hash_id(href),
                "title": text,
                "summary": "From TLDR AI...",
                "content": "",
                "source": source["name"],
                "sourceIcon": source["icon"],
                "sourceColor": source["color"],
                "url": href,
                "publishedAt": datetime.datetime.now(datetime.timezone.utc).isoformat(),
                "categories": detect_categories(text),
            })
        return articles
    except Exception as e:
        print(f"Error fetching TLDR: {e}")
        return []

# ─── Main Logic ───

@app.function(image=image, schedule=modal.Period(days=1))
def fetch_daily_news():
    print("Starting daily news fetch...")
    all_articles = []
    
    for source in SOURCES:
        if source["type"] == "rss":
            all_articles.extend(fetch_rss(source))
        elif source["id"] == "rundown":
            all_articles.extend(fetch_html_rundown(source))
        elif source["id"] == "tldr":
            all_articles.extend(fetch_html_tldr(source))
            
    # Deduplicate by ID
    unique_articles = {art["id"]: art for art in all_articles}.values()
    
    # Rank
    ranked = sorted(unique_articles, key=score_article, reverse=True)
    
    # Top 20
    top_20 = ranked[:20]
    
    print(f"Seelected {len(top_20)} articles from {len(all_articles)} raw items.")
    
    # Store
    news_storage["latest_news"] = top_20
    news_storage["last_update"] = datetime.datetime.now(datetime.timezone.utc).isoformat()
    
    return top_20

@app.function(image=image)
@modal.fastapi_endpoint()
def get_news():
    news = news_storage.get("latest_news", [])
    updated = news_storage.get("last_update", "")
    
    # If empty, try to fetch immediately (warmup)
    if not news:
        print("Storage empty, triggering fetch...")
        news = fetch_daily_news.local()
    
    return {
        "articles": news,
        "updatedAt": updated,
        "count": len(news)
    }

if __name__ == "__main__":
    # For local testing
    with app.run():
        fetch_daily_news.remote()
        print("Test run complete.")
