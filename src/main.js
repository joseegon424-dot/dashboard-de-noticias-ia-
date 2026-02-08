/**
 * AI Pulse Dashboard — Main Application v3
 * Cognisium Lab © 2026
 *
 * 8 sources, auto-refresh 5min, in-app article reading, categories, dismiss
 */

import { fetchAllSources, fetchArticleContent, SOURCES } from '../tools/feed-parser.js';
import {
    getArticles,
    saveArticles,
    toggleSaved,
    dismissArticle,
    undoDismiss,
    markAsRead,
    needsRefresh,
    setLastFetch,
    getLastFetch,
    getAllCategories,
    getUniqueSources,
} from '../tools/storage.js';

// ─── Config ───
const REFRESH_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

// ─── State ───
const state = {
    articles: [],
    filteredArticles: [],
    view: 'all',
    activeCategory: 'all',
    activeSource: null,
    searchQuery: '',
    isLoading: false,
    currentModal: null,
    lastDismissed: null,
    refreshTimer: null,
    contentCache: new Map(), // cache fetched article content
};

// Source color map from registry
const SOURCE_COLORS = {};
SOURCES.forEach(s => { SOURCE_COLORS[s.name] = s.color; });

// ─── DOM ───
const $ = id => document.getElementById(id);
const DOM = {
    grid: $('articles-grid'),
    emptyState: $('empty-state'),
    loadingState: $('loading-state'),
    searchInput: $('search-input'),
    statTotal: $('stat-total'),
    statSources: $('stat-sources'),
    statSaved: $('stat-saved'),
    statNew: $('stat-new'),
    lastUpdated: $('last-updated'),
    statusText: $('status-text'),
    statusDot: $('status-dot'),
    btnRefresh: $('btn-refresh'),
    sourceFilters: $('source-filters'),
    categoryBar: $('category-bar'),
    navAll: $('nav-all'),
    navSaved: $('nav-saved'),
    navDismissed: $('nav-dismissed'),
    savedCount: $('saved-count'),
    dismissedCount: $('dismissed-count'),
    modalOverlay: $('modal-overlay'),
    modalSource: $('modal-source'),
    modalDate: $('modal-date'),
    modalTitle: $('modal-title'),
    modalContent: $('modal-content'),
    modalCategories: $('modal-categories'),
    modalLink: $('modal-link'),
    modalSave: $('modal-save'),
    modalDismiss: $('modal-dismiss'),
    modalClose: $('modal-close'),
    toast: $('toast'),
    toastMessage: $('toast-message'),
    toastUndo: $('toast-undo'),
    menuToggle: $('menu-toggle'),
    sidebar: $('sidebar'),
};

// ═══════════════════════════════════════════════════════
// DATA PIPELINE
// ═══════════════════════════════════════════════════════

async function fetchAllFeeds() {
    state.isLoading = true;
    showLoading(true);
    setStatus('Escaneando 8 fuentes…', 'loading');

    try {
        const allArticles = await fetchAllSources();
        state.articles = saveArticles(allArticles);
        setLastFetch();

        const sourceCount = getUniqueSources(state.articles.filter(a => !a.dismissed)).length;
        setStatus(`${sourceCount} fuentes activas`, 'online');
        showToast(`🔄 ${allArticles.length} artículos de ${sourceCount} fuentes`);
    } catch (err) {
        console.error('[Pipeline] Error:', err);
        setStatus('Error al cargar', 'error');
        state.articles = getArticles();
    } finally {
        state.isLoading = false;
        showLoading(false);
        applyFilters();
        renderAll();
    }
}

function loadCached() {
    state.articles = getArticles();
    if (state.articles.length > 0) {
        const sourceCount = getUniqueSources(state.articles.filter(a => !a.dismissed)).length;
        setStatus(`${sourceCount} fuentes`, 'online');
    }
    applyFilters();
    renderAll();
}

/**
 * Start auto-refresh every 5 minutes
 */
function startAutoRefresh() {
    if (state.refreshTimer) clearInterval(state.refreshTimer);
    state.refreshTimer = setInterval(async () => {
        console.log('[AutoRefresh] ⏰ Refreshing feeds…');
        setStatus('Actualizando…', 'loading');
        await fetchAllFeeds();
    }, REFRESH_INTERVAL_MS);
    console.log(`[AutoRefresh] ⏰ Set to refresh every ${REFRESH_INTERVAL_MS / 60000} min`);
}

// ═══════════════════════════════════════════════════════
// FILTERING
// ═══════════════════════════════════════════════════════

function applyFilters() {
    let articles = [...state.articles];

    switch (state.view) {
        case 'saved':
            articles = articles.filter(a => a.saved);
            break;
        case 'dismissed':
            articles = articles.filter(a => a.dismissed);
            break;
        default:
            articles = articles.filter(a => !a.dismissed);
            break;
    }

    if (state.activeSource) {
        articles = articles.filter(a => a.source === state.activeSource);
    }

    if (state.activeCategory !== 'all') {
        articles = articles.filter(a =>
            (a.categories || []).includes(state.activeCategory)
        );
    }

    if (state.searchQuery.trim()) {
        const q = state.searchQuery.toLowerCase();
        articles = articles.filter(a =>
            a.title.toLowerCase().includes(q) ||
            (a.summary || '').toLowerCase().includes(q) ||
            a.source.toLowerCase().includes(q) ||
            (a.categories || []).some(c => c.toLowerCase().includes(q))
        );
    }

    state.filteredArticles = articles;
}

// ═══════════════════════════════════════════════════════
// RENDERING
// ═══════════════════════════════════════════════════════

function renderAll() {
    renderArticles();
    renderStats();
    renderCategories();
    renderSourceFilters();
    renderLastUpdated();
    updateNavCounts();
}

function renderArticles() {
    const { filteredArticles } = state;

    if (filteredArticles.length === 0 && !state.isLoading) {
        DOM.grid.classList.add('hidden');
        DOM.emptyState.classList.remove('hidden');
        return;
    }

    DOM.emptyState.classList.add('hidden');
    DOM.grid.classList.remove('hidden');

    DOM.grid.innerHTML = filteredArticles
        .map((art, i) => createCard(art, i))
        .join('');

    // Events
    DOM.grid.querySelectorAll('.article-card').forEach(card => {
        const id = card.dataset.id;

        card.addEventListener('click', e => {
            if (e.target.closest('.article-card__btn') || e.target.closest('.article-card__read-link')) return;
            openModal(id);
        });

        card.querySelector('.save-btn')?.addEventListener('click', e => {
            e.stopPropagation();
            handleToggleSave(id);
        });

        card.querySelector('.dismiss-btn')?.addEventListener('click', e => {
            e.stopPropagation();
            handleDismiss(id);
        });

        card.querySelector('.restore-btn')?.addEventListener('click', e => {
            e.stopPropagation();
            handleRestore(id);
        });
    });
}

function createCard(art, index) {
    const timeAgo = getTimeAgo(art.publishedAt);
    const isNew = isWithin(art.publishedAt, 12);
    const isDismissedView = state.view === 'dismissed';
    const delay = Math.min(index * 35, 350);
    const srcColor = SOURCE_COLORS[art.source] || '#00FF88';

    const catsHtml = (art.categories || []).slice(0, 3)
        .map(c => `<span class="article-card__cat-tag">${c}</span>`)
        .join('');

    return `
    <div class="article-card ${isDismissedView ? 'dismissed-view' : ''}"
         data-id="${art.id}"
         style="animation-delay:${delay}ms; border-left: 3px solid ${srcColor}">
      ${isNew && !isDismissedView ? '<div class="article-card__new-badge"></div>' : ''}

      <div class="article-card__top">
        <span class="article-card__source" style="color:${srcColor}">
          ${art.sourceIcon} ${art.source}
        </span>
        <div class="article-card__actions">
          ${isDismissedView ? `
            <button class="article-card__btn restore-btn" title="Restaurar">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>
            </button>
          ` : `
            <button class="article-card__btn save-btn ${art.saved ? 'saved' : ''}" title="${art.saved ? 'Quitar' : 'Guardar'}">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="${art.saved ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>
            </button>
            <button class="article-card__btn dismiss-btn" title="Eliminar">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          `}
        </div>
      </div>

      <h3 class="article-card__title">${escapeHtml(art.title)}</h3>
      ${art.summary ? `<p class="article-card__summary">${escapeHtml(art.summary)}</p>` : ''}
      ${catsHtml ? `<div class="article-card__cats">${catsHtml}</div>` : ''}

      <div class="article-card__footer">
        <span class="article-card__time">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          ${timeAgo}
        </span>
        <span class="article-card__read-cta" style="color:${srcColor}; cursor:pointer; font-size:11px; font-weight:600;">
          Leer resumen →
        </span>
      </div>
    </div>
  `;
}

function renderStats() {
    const visible = state.articles.filter(a => !a.dismissed);
    const sources = getUniqueSources(visible);
    const saved = state.articles.filter(a => a.saved);
    const newToday = visible.filter(a => isWithin(a.publishedAt, 24));

    animateNum(DOM.statTotal, visible.length);
    animateNum(DOM.statSources, sources.length);
    animateNum(DOM.statSaved, saved.length);
    animateNum(DOM.statNew, newToday.length);
}

function renderCategories() {
    const visible = state.articles.filter(a => !a.dismissed);
    const cats = getAllCategories(visible);

    DOM.categoryBar.innerHTML = `
    <button class="cat-pill ${state.activeCategory === 'all' ? 'active' : ''}" data-category="all">🔥 Todas</button>
    ${cats.map(c => `
      <button class="cat-pill ${state.activeCategory === c.name ? 'active' : ''}" data-category="${c.name}">
        ${c.name} <span class="cat-pill__count">${c.count}</span>
      </button>
    `).join('')}
  `;

    DOM.categoryBar.querySelectorAll('.cat-pill').forEach(pill => {
        pill.addEventListener('click', () => {
            state.activeCategory = pill.dataset.category;
            applyFilters();
            renderAll();
        });
    });
}

function renderSourceFilters() {
    const visible = state.articles.filter(a => !a.dismissed);
    const sources = getUniqueSources(visible);

    DOM.sourceFilters.innerHTML = sources.map(src => `
    <button class="source-btn ${state.activeSource === src.name ? 'active' : ''}" data-source="${src.name}">
      <span class="source-btn__dot" style="background:${SOURCE_COLORS[src.name] || '#00FF88'}"></span>
      ${src.icon} ${src.name}
      <span class="source-btn__count">${src.count}</span>
    </button>
  `).join('');

    DOM.sourceFilters.querySelectorAll('.source-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const s = btn.dataset.source;
            state.activeSource = state.activeSource === s ? null : s;
            applyFilters();
            renderAll();
        });
    });
}

function renderLastUpdated() {
    const last = getLastFetch();
    if (last) {
        DOM.lastUpdated.textContent = `Actualizado: ${formatDate(last)}`;
    }
}

function updateNavCounts() {
    DOM.savedCount.textContent = state.articles.filter(a => a.saved).length;
    DOM.dismissedCount.textContent = state.articles.filter(a => a.dismissed).length;
}

// ═══════════════════════════════════════════════════════
// MODAL — In-App Article Reading
// ═══════════════════════════════════════════════════════

async function openModal(articleId) {
    const art = state.articles.find(a => a.id === articleId);
    if (!art) return;

    state.currentModal = art;
    markAsRead(articleId);

    const srcColor = SOURCE_COLORS[art.source] || '#00FF88';
    DOM.modalSource.textContent = `${art.sourceIcon} ${art.source}`;
    DOM.modalSource.style.borderColor = srcColor;
    DOM.modalSource.style.color = srcColor;
    DOM.modalDate.textContent = formatDate(art.publishedAt);
    DOM.modalTitle.textContent = art.title;
    DOM.modalLink.href = art.url;

    // Categories
    DOM.modalCategories.innerHTML = (art.categories || [])
        .map(c => `<span class="modal__cat-tag">${c}</span>`)
        .join('');

    // Save btn state
    updateModalSaveBtn(art.saved);

    // Show modal immediately with existing content or loading
    DOM.modalOverlay.classList.remove('hidden');
    document.body.style.overflow = 'hidden';

    // If we already have rich content, show it
    if (art.content && art.content.length > 100) {
        DOM.modalContent.innerHTML = art.content;
    } else {
        // Show loading indicator then fetch the full article
        DOM.modalContent.innerHTML = `
      <div style="text-align:center;padding:32px 0;color:#555;">
        <div style="display:inline-flex;gap:4px;margin-bottom:12px;">
          <span style="width:4px;height:16px;background:#00FF88;border-radius:2px;animation:loaderBar 1s ease-in-out infinite;"></span>
          <span style="width:4px;height:16px;background:#00FF88;border-radius:2px;animation:loaderBar 1s ease-in-out infinite 0.1s;"></span>
          <span style="width:4px;height:16px;background:#00FF88;border-radius:2px;animation:loaderBar 1s ease-in-out infinite 0.2s;"></span>
        </div>
        <p style="font-size:12px;color:#555;">Cargando artículo completo…</p>
      </div>
    `;

        // Check cache first
        if (state.contentCache.has(art.url)) {
            DOM.modalContent.innerHTML = state.contentCache.get(art.url);
        } else {
            try {
                const fullContent = await fetchArticleContent(art.url);
                state.contentCache.set(art.url, fullContent);

                // Update article in state
                art.content = fullContent;

                // Only update if modal is still showing this article
                if (state.currentModal?.id === articleId) {
                    DOM.modalContent.innerHTML = fullContent;
                }
            } catch (err) {
                if (state.currentModal?.id === articleId) {
                    DOM.modalContent.innerHTML = `
            <p style="color:#888;font-size:13px;line-height:1.7;">
              ${art.summary || 'No se pudo cargar el contenido completo.'}
            </p>
            <p style="color:#555;font-size:12px;margin-top:12px;">
              Usa el enlace inferior para leer el artículo original.
            </p>
          `;
                }
            }
        }
    }
}

function closeModal() {
    DOM.modalOverlay.classList.add('hidden');
    document.body.style.overflow = '';
    state.currentModal = null;
}

function updateModalSaveBtn(saved) {
    DOM.modalSave.classList.toggle('saved', saved);
    DOM.modalSave.innerHTML = `
    <svg width="18" height="18" viewBox="0 0 24 24" fill="${saved ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>
    ${saved ? 'Guardado' : 'Guardar'}
  `;
}

// ═══════════════════════════════════════════════════════
// ACTIONS
// ═══════════════════════════════════════════════════════

function handleToggleSave(id) {
    const isSaved = toggleSaved(id);
    state.articles = state.articles.map(a => a.id === id ? { ...a, saved: isSaved } : a);
    applyFilters();
    renderAll();
    showToast(isSaved ? '✅ Guardado' : '🗑️ Removido');
    if (state.currentModal?.id === id) updateModalSaveBtn(isSaved);
}

function handleDismiss(id) {
    dismissArticle(id);
    state.articles = state.articles.map(a => a.id === id ? { ...a, dismissed: true } : a);
    state.lastDismissed = id;
    applyFilters();
    renderAll();
    showToast('🗑️ Eliminado', true);
    if (state.currentModal?.id === id) closeModal();
}

function handleRestore(id) {
    undoDismiss(id);
    state.articles = state.articles.map(a => a.id === id ? { ...a, dismissed: false } : a);
    applyFilters();
    renderAll();
    showToast('↩️ Restaurado');
}

// ═══════════════════════════════════════════════════════
// EVENT LISTENERS
// ═══════════════════════════════════════════════════════

function initEvents() {
    DOM.navAll.addEventListener('click', () => switchView('all'));
    DOM.navSaved.addEventListener('click', () => switchView('saved'));
    DOM.navDismissed.addEventListener('click', () => switchView('dismissed'));

    let st;
    DOM.searchInput.addEventListener('input', e => {
        clearTimeout(st);
        st = setTimeout(() => {
            state.searchQuery = e.target.value;
            applyFilters();
            renderArticles();
        }, 250);
    });

    DOM.btnRefresh.addEventListener('click', () => {
        DOM.btnRefresh.classList.add('loading');
        fetchAllFeeds().finally(() => DOM.btnRefresh.classList.remove('loading'));
    });

    DOM.modalClose.addEventListener('click', closeModal);
    DOM.modalOverlay.addEventListener('click', e => {
        if (e.target === DOM.modalOverlay) closeModal();
    });
    DOM.modalSave.addEventListener('click', () => {
        if (state.currentModal) handleToggleSave(state.currentModal.id);
    });
    DOM.modalDismiss.addEventListener('click', () => {
        if (state.currentModal) handleDismiss(state.currentModal.id);
    });

    DOM.toastUndo.addEventListener('click', () => {
        if (state.lastDismissed) {
            handleRestore(state.lastDismissed);
            state.lastDismissed = null;
        }
    });

    document.addEventListener('keydown', e => {
        if (e.key === 'Escape') closeModal();
        if (e.key === '/' && document.activeElement !== DOM.searchInput) {
            e.preventDefault();
            DOM.searchInput.focus();
        }
    });

    DOM.menuToggle.addEventListener('click', () => {
        DOM.sidebar.classList.toggle('open');
    });

    document.addEventListener('click', e => {
        if (window.innerWidth <= 768 &&
            DOM.sidebar.classList.contains('open') &&
            !DOM.sidebar.contains(e.target) &&
            !DOM.menuToggle.contains(e.target)) {
            DOM.sidebar.classList.remove('open');
        }
    });
}

function switchView(view) {
    state.view = view;
    state.activeCategory = 'all';
    state.activeSource = null;
    state.searchQuery = '';
    DOM.searchInput.value = '';
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    $(`nav-${view}`).classList.add('active');
    applyFilters();
    renderAll();
    if (window.innerWidth <= 768) DOM.sidebar.classList.remove('open');
}

// ═══════════════════════════════════════════════════════
// UTILITIES
// ═══════════════════════════════════════════════════════

function showLoading(show) {
    DOM.loadingState.classList.toggle('hidden', !show);
    if (show) { DOM.grid.classList.add('hidden'); DOM.emptyState.classList.add('hidden'); }
}

function setStatus(text, type = 'online') {
    DOM.statusText.textContent = text;
    DOM.statusDot.className = 'status-dot';
    if (type === 'error') DOM.statusDot.classList.add('error');
    else if (type === 'loading') DOM.statusDot.classList.add('idle');
}

let toastTimer;
function showToast(msg, undo = false) {
    clearTimeout(toastTimer);
    DOM.toast.classList.remove('hidden');
    DOM.toastMessage.textContent = msg;
    DOM.toastUndo.classList.toggle('hidden', !undo);
    toastTimer = setTimeout(() => DOM.toast.classList.add('hidden'), undo ? 5000 : 3000);
}

function animateNum(el, target) {
    const cur = parseInt(el.textContent) || 0;
    if (cur === target) return;
    const d = target - cur;
    const s = Math.min(Math.abs(d), 15);
    const inc = d / s;
    let i = 0;
    const t = () => {
        i++;
        if (i >= s) { el.textContent = target; return; }
        el.textContent = Math.round(cur + inc * i);
        requestAnimationFrame(t);
    };
    requestAnimationFrame(t);
}

function getTimeAgo(d) {
    try {
        const diff = Date.now() - new Date(d).getTime();
        const m = Math.floor(diff / 60000);
        if (m < 1) return 'Ahora';
        if (m < 60) return `${m}m`;
        const h = Math.floor(m / 60);
        if (h < 24) return `${h}h`;
        return `${Math.floor(h / 24)}d`;
    } catch { return ''; }
}

function isWithin(d, h) {
    try { return (Date.now() - new Date(d).getTime()) < h * 3600000; }
    catch { return false; }
}

function formatDate(d) {
    try {
        return new Intl.DateTimeFormat('es', {
            day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
        }).format(new Date(d));
    } catch { return ''; }
}

function escapeHtml(s) {
    const d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
}

// ═══════════════════════════════════════════════════════
// INIT
// ═══════════════════════════════════════════════════════

async function init() {
    console.log('[AI Pulse] 🚀 v3 — 8 fuentes, auto-refresh 5min, lectura in-app');
    initEvents();
    loadCached();

    if (needsRefresh(0.08) || state.articles.length === 0) { // 0.08h = ~5min
        await fetchAllFeeds();
    } else {
        renderLastUpdated();
    }

    // Start auto-refresh every 5 minutes
    startAutoRefresh();

    console.log('[AI Pulse] ✅ Ready — Next refresh in 5 minutes');
}

init();
