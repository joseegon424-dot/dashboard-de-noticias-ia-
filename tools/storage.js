/**
 * Storage Layer v2 — tools/storage.js
 * localStorage abstraction with save + dismiss + categories
 */

const STORAGE_KEYS = {
    ARTICLES: 'cognisium_articles',
    SAVED: 'cognisium_saved',
    DISMISSED: 'cognisium_dismissed',
    LAST_FETCH: 'cognisium_last_fetch',
};

/**
 * Get all cached articles
 */
export function getArticles() {
    try {
        const data = localStorage.getItem(STORAGE_KEYS.ARTICLES);
        return data ? JSON.parse(data) : [];
    } catch {
        return [];
    }
}

/**
 * Save articles to cache (merge, deduplicate, preserve states)
 */
export function saveArticles(newArticles) {
    try {
        const existing = getArticles();
        const savedIds = getSavedIds();
        const dismissedIds = getDismissedIds();
        const merged = new Map();

        // Existing first
        existing.forEach(art => merged.set(art.id, art));

        // New articles — preserve saved/dismissed state
        newArticles.forEach(art => {
            const prev = merged.get(art.id);
            merged.set(art.id, {
                ...art,
                saved: savedIds.has(art.id) || prev?.saved || false,
                read: prev?.read || false,
                dismissed: dismissedIds.has(art.id) || prev?.dismissed || false,
            });
        });

        const allArticles = Array.from(merged.values())
            .sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));

        localStorage.setItem(STORAGE_KEYS.ARTICLES, JSON.stringify(allArticles));
        return allArticles;
    } catch (err) {
        console.error('[Storage] Failed to save articles:', err);
        return newArticles;
    }
}

// ─── Saved ───

function getSavedIds() {
    try {
        const data = localStorage.getItem(STORAGE_KEYS.SAVED);
        return new Set(data ? JSON.parse(data) : []);
    } catch {
        return new Set();
    }
}

export function toggleSaved(articleId) {
    const savedIds = getSavedIds();
    const isSaved = savedIds.has(articleId);

    if (isSaved) savedIds.delete(articleId);
    else savedIds.add(articleId);

    localStorage.setItem(STORAGE_KEYS.SAVED, JSON.stringify([...savedIds]));

    const articles = getArticles();
    const updated = articles.map(art =>
        art.id === articleId ? { ...art, saved: !isSaved } : art
    );
    localStorage.setItem(STORAGE_KEYS.ARTICLES, JSON.stringify(updated));

    return !isSaved;
}

export function getSavedArticles() {
    return getArticles().filter(art => art.saved);
}

// ─── Dismissed (Delete) ───

function getDismissedIds() {
    try {
        const data = localStorage.getItem(STORAGE_KEYS.DISMISSED);
        return new Set(data ? JSON.parse(data) : []);
    } catch {
        return new Set();
    }
}

export function dismissArticle(articleId) {
    const dismissedIds = getDismissedIds();
    dismissedIds.add(articleId);
    localStorage.setItem(STORAGE_KEYS.DISMISSED, JSON.stringify([...dismissedIds]));

    const articles = getArticles();
    const updated = articles.map(art =>
        art.id === articleId ? { ...art, dismissed: true } : art
    );
    localStorage.setItem(STORAGE_KEYS.ARTICLES, JSON.stringify(updated));
}

export function undoDismiss(articleId) {
    const dismissedIds = getDismissedIds();
    dismissedIds.delete(articleId);
    localStorage.setItem(STORAGE_KEYS.DISMISSED, JSON.stringify([...dismissedIds]));

    const articles = getArticles();
    const updated = articles.map(art =>
        art.id === articleId ? { ...art, dismissed: false } : art
    );
    localStorage.setItem(STORAGE_KEYS.ARTICLES, JSON.stringify(updated));
}

/**
 * Get visible articles (not dismissed)
 */
export function getVisibleArticles() {
    return getArticles().filter(art => !art.dismissed);
}

// ─── Read ───

export function markAsRead(articleId) {
    const articles = getArticles();
    const updated = articles.map(art =>
        art.id === articleId ? { ...art, read: true } : art
    );
    localStorage.setItem(STORAGE_KEYS.ARTICLES, JSON.stringify(updated));
}

// ─── Meta ───

export function needsRefresh(hoursThreshold = 24) {
    try {
        const lastFetch = localStorage.getItem(STORAGE_KEYS.LAST_FETCH);
        if (!lastFetch) return true;
        return (Date.now() - new Date(lastFetch).getTime()) > hoursThreshold * 3600000;
    } catch {
        return true;
    }
}

export function setLastFetch() {
    localStorage.setItem(STORAGE_KEYS.LAST_FETCH, new Date().toISOString());
}

export function getLastFetch() {
    return localStorage.getItem(STORAGE_KEYS.LAST_FETCH) || null;
}

/**
 * Get all unique categories from articles
 */
export function getAllCategories(articles) {
    const cats = new Map();
    articles.forEach(art => {
        (art.categories || []).forEach(cat => {
            cats.set(cat, (cats.get(cat) || 0) + 1);
        });
    });
    return Array.from(cats.entries())
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count);
}

/**
 * Get unique sources
 */
export function getUniqueSources(articles) {
    const sources = new Map();
    articles.forEach(art => {
        if (!sources.has(art.source)) {
            sources.set(art.source, { name: art.source, icon: art.sourceIcon, count: 0 });
        }
        sources.get(art.source).count++;
    });
    return Array.from(sources.values());
}

export function clearAll() {
    Object.values(STORAGE_KEYS).forEach(key => localStorage.removeItem(key));
}
