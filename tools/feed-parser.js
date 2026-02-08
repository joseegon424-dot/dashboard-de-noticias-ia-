/**
 * Feed Parser v3 — tools/feed-parser.js
 * 8+ AI news sources with full content extraction
 * Auto-categorization with 10 topic rules
 */

const CORS_PROXIES = [
    'https://api.allorigins.win/raw?url=',
    'https://corsproxy.io/?',
];

// ─── Sources Registry ───
export const SOURCES = [
    {
        id: 'rundown',
        name: 'The Rundown AI',
        icon: '🏃',
        color: '#FF6B35',
        type: 'html',
        url: 'https://www.therundown.ai/',
    },
    {
        id: 'venturebeat',
        name: 'VentureBeat AI',
        icon: '📡',
        color: '#4A9EFF',
        type: 'rss',
        url: 'https://venturebeat.com/category/ai/feed/',
    },
    {
        id: 'ainews',
        name: 'AI News',
        icon: '🤖',
        color: '#00CED1',
        type: 'rss',
        url: 'https://www.artificialintelligence-news.com/feed/',
    },
    {
        id: 'decoder',
        name: 'The Decoder',
        icon: '🧩',
        color: '#A855F7',
        type: 'rss',
        url: 'https://the-decoder.com/feed/',
    },
    {
        id: 'marktechpost',
        name: 'MarkTechPost',
        icon: '📊',
        color: '#FF3366',
        type: 'rss',
        url: 'https://www.marktechpost.com/feed/',
    },
    {
        id: 'bens',
        name: "Ben's Bites",
        icon: '🍪',
        color: '#FFD700',
        type: 'rss',
        url: 'https://bensbites.substack.com/feed',
    },
    {
        id: 'tldr',
        name: 'TLDR AI',
        icon: '⚡',
        color: '#32CD32',
        type: 'html',
        url: 'https://tldr.tech/ai',
    },
    {
        id: 'techcrunch',
        name: 'TechCrunch AI',
        icon: '💚',
        color: '#0A8F00',
        type: 'rss',
        url: 'https://techcrunch.com/category/artificial-intelligence/feed/',
    },
];

// ─── Category Detection ───
const CATEGORY_RULES = [
    { category: '🎬 Video IA', keywords: ['video', 'sora', 'runway', 'pika', 'kling', 'luma', 'animate', 'clip', 'footage', 'film', 'cinema', 'veo', 'dreamina'] },
    { category: '💰 Ganar Dinero', keywords: ['money', 'revenue', 'business', 'monetiz', 'income', 'profit', 'startup', 'enterprise', 'saas', 'freelanc', 'side hustle', 'pricing', 'million', 'billion', 'funding', 'valuation', 'ipo', 'acquisition'] },
    { category: '🤖 Agentes IA', keywords: ['agent', 'agentic', 'autonomous', 'automat', 'workflow', 'codex', 'claude code', 'mcp', 'copilot', 'cowork', 'orchestrat'] },
    { category: '🖼️ Imagen IA', keywords: ['image', 'midjourney', 'dall-e', 'stable diffusion', 'flux', 'grok imagine', 'ideogram', 'imagen', 'generate image', 'illustration'] },
    { category: '🧠 Modelos', keywords: ['model', 'gpt', 'claude', 'gemini', 'llama', 'mistral', 'opus', 'sonnet', 'o1', 'o3', 'benchmark', 'parameter', 'training', 'fine-tun', 'frontier'] },
    { category: '🔧 Herramientas', keywords: ['tool', 'app', 'plugin', 'extension', 'chrome', 'api', 'sdk', 'platform', 'launch', 'release', 'feature'] },
    { category: '🏢 Big Tech', keywords: ['openai', 'google', 'meta', 'microsoft', 'apple', 'amazon', 'nvidia', 'anthropic', 'xai', 'elon', 'sam altman', 'deepmind', 'salesforce'] },
    { category: '🎓 Guías & Tips', keywords: ['guide', 'tutorial', 'how to', 'step-by-step', 'tips', 'learn', 'training', 'prompt', 'excel', 'hack', 'workflow'] },
    { category: '🔬 Investigación', keywords: ['research', 'paper', 'study', 'breakthrough', 'discovery', 'science', 'lab', 'arxiv', 'experiment'] },
    { category: '🤝 Open Source', keywords: ['open source', 'open-source', 'github', 'hugging face', 'self-host', 'local model', 'weight', 'replicate'] },
];

function detectCategories(title, content = '') {
    const text = (title + ' ' + content).toLowerCase();
    const matched = [];
    for (const rule of CATEGORY_RULES) {
        for (const kw of rule.keywords) {
            if (text.includes(kw)) {
                if (!matched.includes(rule.category)) matched.push(rule.category);
                break;
            }
        }
    }
    return matched.length > 0 ? matched : ['📰 General'];
}

// ─── Utilities ───

async function fetchWithProxy(url) {
    let lastError = null;
    for (const proxy of CORS_PROXIES) {
        try {
            const proxyUrl = proxy + encodeURIComponent(url);
            const res = await fetch(proxyUrl, { signal: AbortSignal.timeout(20000) });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            return await res.text();
        } catch (err) {
            lastError = err;
        }
    }
    throw new Error(`Proxies failed for ${url}: ${lastError?.message}`);
}

function hashId(str) {
    let h = 0;
    for (let i = 0; i < str.length; i++) {
        h = ((h << 5) - h) + str.charCodeAt(i);
        h |= 0;
    }
    return 'art_' + Math.abs(h).toString(36);
}

function stripHtml(html) {
    const d = new DOMParser().parseFromString(html, 'text/html');
    return d.body.textContent || '';
}

function cleanHtmlContent(html) {
    const d = new DOMParser().parseFromString(html, 'text/html');
    // Remove scripts, styles, ads, social
    d.querySelectorAll('script, style, iframe, object, embed, .social-share, .ad, .newsletter-signup, .subscribe, nav, footer, header').forEach(e => e.remove());
    // Remove event handlers
    d.querySelectorAll('*').forEach(el => {
        Array.from(el.attributes).forEach(attr => {
            if (attr.name.startsWith('on')) el.removeAttribute(attr.name);
        });
    });
    return d.body.innerHTML;
}

function extractSummary(html, maxLen = 280) {
    const text = stripHtml(html);
    if (text.length <= maxLen) return text;
    return text.substring(0, maxLen).replace(/\s+\S*$/, '') + '…';
}

/**
 * Format RSS content into readable article with key points
 */
function formatArticleContent(rawContent, title) {
    if (!rawContent) return '';

    const doc = new DOMParser().parseFromString(rawContent, 'text/html');

    // Remove unwanted elements
    doc.querySelectorAll('script, style, iframe, .ad, .social, figure img[src*="tracking"], [class*="subscribe"]').forEach(e => e.remove());

    // Extract text paragraphs
    const paragraphs = [];
    doc.querySelectorAll('p, li, h2, h3, h4, h5, h6').forEach(el => {
        const text = el.textContent?.trim();
        if (!text || text.length < 15) return;

        const tag = el.tagName.toLowerCase();
        if (tag.startsWith('h')) {
            paragraphs.push({ type: 'heading', text });
        } else if (tag === 'li') {
            paragraphs.push({ type: 'bullet', text });
        } else {
            paragraphs.push({ type: 'paragraph', text });
        }
    });

    if (paragraphs.length === 0) return '';

    // Build formatted HTML
    let html = '';
    let bulletGroup = false;

    for (const p of paragraphs) {
        if (p.type === 'heading') {
            if (bulletGroup) { html += '</ul>'; bulletGroup = false; }
            html += `<h3 style="color:#00FF88;margin:16px 0 8px;font-size:14px;font-weight:700;">${escapeText(p.text)}</h3>`;
        } else if (p.type === 'bullet') {
            if (!bulletGroup) { html += '<ul style="margin:8px 0;padding-left:20px;">'; bulletGroup = true; }
            html += `<li style="margin:4px 0;color:#ccc;font-size:13px;line-height:1.6;">${escapeText(p.text)}</li>`;
        } else {
            if (bulletGroup) { html += '</ul>'; bulletGroup = false; }
            html += `<p style="margin:8px 0;color:#bbb;font-size:13px;line-height:1.7;">${escapeText(p.text)}</p>`;
        }
    }

    if (bulletGroup) html += '</ul>';

    return html;
}

function escapeText(str) {
    const d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
}

function isWithinHours(dateStr, hours = 168) {
    try {
        return (Date.now() - new Date(dateStr).getTime()) <= hours * 3600000;
    } catch { return true; }
}

// ═══════════════════════════════════════════════════════
// RSS FEED PARSER (VentureBeat, AI News, Decoder, etc.)
// ═══════════════════════════════════════════════════════

function parseRssFeed(xmlText, source) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlText, 'application/xml');

    // Check for parse errors
    const parseError = doc.querySelector('parsererror');
    if (parseError) {
        // Try as HTML fallback
        return parseRssAsHtml(xmlText, source);
    }

    let items = doc.querySelectorAll('item');
    if (items.length === 0) items = doc.querySelectorAll('entry'); // Atom

    const articles = [];

    items.forEach((item) => {
        const title = (item.querySelector('title')?.textContent || '').trim();
        const link = item.querySelector('link')?.textContent?.trim()
            || item.querySelector('link')?.getAttribute('href') || '';
        const pubDate = item.querySelector('pubDate')?.textContent?.trim()
            || item.querySelector('published')?.textContent?.trim()
            || item.querySelector('updated')?.textContent?.trim() || '';
        const description = item.querySelector('description')?.textContent || '';
        const contentEncoded = item.getElementsByTagNameNS(
            'http://purl.org/rss/1.0/modules/content/', 'encoded'
        )[0]?.textContent || '';

        if (!title || !link) return;
        if (pubDate && !isWithinHours(pubDate)) return;

        // Full content: prefer content:encoded, fallback to description
        const fullContent = contentEncoded || description;
        const formattedContent = formatArticleContent(fullContent, title);
        const categories = detectCategories(title, stripHtml(fullContent));

        articles.push({
            id: hashId(link),
            title,
            summary: extractSummary(description || fullContent),
            content: formattedContent || `<p style="color:#bbb;font-size:13px;line-height:1.7;">${extractSummary(description || fullContent, 500)}</p>`,
            source: source.name,
            sourceIcon: source.icon,
            sourceColor: source.color,
            url: link,
            publishedAt: pubDate ? new Date(pubDate).toISOString() : new Date().toISOString(),
            fetchedAt: new Date().toISOString(),
            categories,
            tags: categories,
            saved: false,
            read: false,
            dismissed: false,
        });
    });

    return articles;
}

/**
 * Fallback: parse XML served as text/html
 */
function parseRssAsHtml(text, source) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(text, 'text/html');
    const articles = [];

    // Try to find linked articles
    const links = doc.querySelectorAll('a[href]');
    const seen = new Set();

    links.forEach(a => {
        const url = a.getAttribute('href') || '';
        const title = a.textContent?.trim() || '';
        if (!url.startsWith('http') || seen.has(url) || title.length < 15 || title.length > 200) return;
        seen.add(url);

        articles.push({
            id: hashId(url),
            title,
            summary: '',
            content: '',
            source: source.name,
            sourceIcon: source.icon,
            sourceColor: source.color,
            url,
            publishedAt: new Date().toISOString(),
            fetchedAt: new Date().toISOString(),
            categories: detectCategories(title),
            tags: detectCategories(title),
            saved: false,
            read: false,
            dismissed: false,
        });
    });

    return articles;
}

// ═══════════════════════════════════════════════════════
// THE RUNDOWN AI — HTML Scraper
// ═══════════════════════════════════════════════════════

function parseRundownPage(html, source) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const articles = [];
    const seen = new Set();

    const links = doc.querySelectorAll('a[href*="/p/"]');

    links.forEach(link => {
        const href = link.getAttribute('href') || '';
        const fullUrl = href.startsWith('http') ? href : `https://www.therundown.ai${href}`;
        if (seen.has(fullUrl) || !fullUrl.includes('/p/')) return;
        seen.add(fullUrl);

        let title = '';
        const titleEl = link.querySelector('h1, h2, h3, h4');
        title = titleEl?.textContent?.trim() || link.textContent?.trim() || '';
        title = title.replace(/PLUS:.*$/i, '').split('\n')[0].trim();

        if (!title || title.length < 10 || title.length > 200) return;

        articles.push({
            id: hashId(fullUrl),
            title,
            summary: '',
            content: '',
            source: source.name,
            sourceIcon: source.icon,
            sourceColor: source.color,
            url: fullUrl,
            publishedAt: new Date().toISOString(),
            fetchedAt: new Date().toISOString(),
            categories: detectCategories(title),
            tags: detectCategories(title),
            saved: false,
            read: false,
            dismissed: false,
        });
    });

    return articles;
}

// ═══════════════════════════════════════════════════════
// TLDR AI — HTML Scraper
// ═══════════════════════════════════════════════════════

function parseTldrPage(html, source) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const articles = [];
    const seen = new Set();

    doc.querySelectorAll('a[href]').forEach(el => {
        const url = el.getAttribute('href') || '';
        if (seen.has(url) || !url.startsWith('http') || url.includes('tldr.tech')) return;
        seen.add(url);

        const text = el.textContent?.trim() || '';
        if (text.length < 15 || text.length > 200) return;

        articles.push({
            id: hashId(url),
            title: text,
            summary: '',
            content: '',
            source: source.name,
            sourceIcon: source.icon,
            sourceColor: source.color,
            url,
            publishedAt: new Date().toISOString(),
            fetchedAt: new Date().toISOString(),
            categories: detectCategories(text),
            tags: detectCategories(text),
            saved: false,
            read: false,
            dismissed: false,
        });
    });

    return articles;
}

// ═══════════════════════════════════════════════════════
// ARTICLE DETAIL FETCHER — For reading within dashboard
// ═══════════════════════════════════════════════════════

/**
 * Fetch full article content for reading inside the modal.
 * Called on-demand when user opens an article.
 */
export async function fetchArticleContent(articleUrl) {
    try {
        const html = await fetchWithProxy(articleUrl);
        const doc = new DOMParser().parseFromString(html, 'text/html');

        // Remove noise
        doc.querySelectorAll('script, style, nav, footer, header, aside, iframe, .ad, .sidebar, .comments, .related, .newsletter, .subscribe, [class*="social"], [class*="share"], [class*="cookie"]').forEach(e => e.remove());

        // Try to find the main article content
        const contentEl = doc.querySelector('article, [class*="post-content"], [class*="article-body"], [class*="entry-content"], [class*="post_content"], .body, main [class*="content"]')
            || doc.querySelector('main')
            || doc.body;

        // Extract OG description as fallback summary
        const ogDesc = doc.querySelector('meta[property="og:description"]')?.getAttribute('content') || '';

        // Format the content nicely
        const formatted = formatArticleContent(contentEl.innerHTML, '');

        // If extraction is poor, use OG description
        if (!formatted || formatted.length < 100) {
            return ogDesc
                ? `<p style="color:#bbb;font-size:13px;line-height:1.7;">${escapeText(ogDesc)}</p>`
                : '<p style="color:#666;font-size:13px;">No se pudo extraer el contenido completo. Usa el enlace para leer el artículo original.</p>';
        }

        return formatted;
    } catch (err) {
        console.warn('[FeedParser] Content fetch failed:', err.message);
        return '<p style="color:#666;font-size:13px;">Error al cargar el contenido. Usa el enlace para leer el artículo original.</p>';
    }
}

// ═══════════════════════════════════════════════════════
// MAIN FETCH FUNCTION
// ═══════════════════════════════════════════════════════

/**
 * Fetch a single source
 */
async function fetchSource(source) {
    try {
        console.log(`[FeedParser] Fetching ${source.icon} ${source.name}...`);
        const text = await fetchWithProxy(source.url);

        let articles = [];
        if (source.type === 'rss') {
            articles = parseRssFeed(text, source);
        } else if (source.id === 'rundown') {
            articles = parseRundownPage(text, source);
        } else if (source.id === 'tldr') {
            articles = parseTldrPage(text, source);
        }

        console.log(`[FeedParser] ${source.icon} ${source.name}: ${articles.length} artículos`);
        return articles;
    } catch (err) {
        console.warn(`[FeedParser] ❌ ${source.name} failed:`, err.message);
        return [];
    }
}

/**
 * Fetch ALL sources in parallel
 */
export async function fetchAllSources() {
    const results = await Promise.allSettled(
        SOURCES.map(src => fetchSource(src))
    );

    const all = [];
    results.forEach((result, i) => {
        if (result.status === 'fulfilled') {
            all.push(...result.value);
        } else {
            console.warn(`[FeedParser] ❌ ${SOURCES[i].name}:`, result.reason);
        }
    });

    return all;
}

export { fetchWithProxy, hashId, stripHtml, extractSummary, isWithinHours, detectCategories, CATEGORY_RULES };
