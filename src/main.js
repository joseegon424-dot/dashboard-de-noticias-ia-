/**
 * AI Pulse Dashboard — Main Application v3 (Modal Backend)
 * Cognisium Lab © 2026
 *
 * Daily Top 20 via Modal API
 */

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
const API_URL = 'https://joseegon424-dot--ai-pulse-news-get-news.modal.run';
const REFRESH_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours check (though backend runs daily)

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
};

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
// DATA PIPELINE (MODAL API)
// ═══════════════════════════════════════════════════════

async function fetchAllFeeds() {
    if (!API_URL || API_URL.includes('replace-me')) {
        setStatus('Falta URL de API', 'error');
        showToast('⚠️ Configura VITE_API_URL en .env');
        return;
    }

    state.isLoading = true;
    showLoading(true);
    setStatus('Conectando a Modal Cloud…', 'loading');

    try {
        const response = await fetch(API_URL);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const data = await response.json();
        const newArticles = data.articles || [];

        // Merge with local state (preserves saved/read status)
        state.articles = saveArticles(newArticles);
        setLastFetch();

        const sourceCount = getUniqueSources(state.articles.filter(a => !a.dismissed)).length;
        setStatus(`${sourceCount} fuentes activas`, 'online');
        showToast(`✅ ${newArticles.length} noticias actualizadas`);

        if (data.updatedAt) {
            DOM.lastUpdated.textContent = `Actualizado: ${formatDate(data.updatedAt)}`;
        }
    } catch (err) {
        console.error('[API] Fetch failed:', err);
        setStatus('Error de conexión', 'error');
        state.articles = getArticles();
        showToast('⚠️ Usando caché local (offline)');
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
 * Check for updates periodically
 */
function startAutoRefresh() {
    // Check every hour if we need refresh
    setInterval(async () => {
        if (needsRefresh(24)) {
            console.log('[AutoRefresh] ⏰ Daily update check…');
            await fetchAllFeeds();
        }
    }, 60 * 60 * 1000);
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
    const isNew = isWithin(art.publishedAt, 24);
    const isDismissedView = state.view === 'dismissed';
    const delay = Math.min(index * 35, 350);
    const srcColor = art.sourceColor || '#00FF88';

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
      <span class="source-btn__dot" style="background:${src.icon ? (src.name === state.activeSource ? '#fff' : '#00FF88') : '#00FF88'}"></span>
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

    const srcColor = art.sourceColor || '#00FF88';
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

    // Show modal
    DOM.modalOverlay.classList.remove('hidden');
    document.body.style.overflow = 'hidden';

    // Content: provided by backend directly
    if (art.content && art.content.length > 50) {
        DOM.modalContent.innerHTML = art.content;
    } else {
        DOM.modalContent.innerHTML = `
          <p style="color:#888;font-size:13px;line-height:1.7;">
            ${art.summary || 'Resumen no disponible.'}
          </p>
          <p style="color:#555;font-size:12px;margin-top:12px;">
            <a href="${art.url}" target="_blank" style="color:#00FF88;">Leer completo en la fuente original →</a>
          </p>
        `;
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
    console.log('[AI Pulse] 🚀 v4 Backend Modal');
    initEvents();
    loadCached();

    if (needsRefresh(24) || state.articles.length === 0) { // 24 hour cache
        await fetchAllFeeds();
    } else {
        renderLastUpdated();
    }

    startAutoRefresh();
}

init();
