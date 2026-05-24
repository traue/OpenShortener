(function () {
    'use strict';

    // ── Config ───────────────────────────────────────────────
    var API = '/api/v1';
    var SUPPORTED_LANGS = ['en', 'pt-BR', 'es'];
    var DEFAULT_LANG = 'en';

    // ── State ────────────────────────────────────────────────
    var currentUser = null;
    var lang = {};
    var langCode = '';
    var allUrls = [];
    var currentPage = 1;
    var perPage = 10;
    var totalUrls = 0;
    var currentSearch = '';
    var searchDebounce = null;

    // ── DOM refs ─────────────────────────────────────────────
    var $ = function (sel) { return document.querySelector(sel); };
    var $$ = function (sel) { return document.querySelectorAll(sel); };

    var langToggle   = $('#lang-toggle');
    var langIcon     = $('#lang-icon');
    var langMenu     = $('#lang-menu');
    var langDropdown = langToggle.closest('.lang-dropdown');
    var themeToggle  = $('#theme-toggle');
    var themeIcon    = $('#theme-icon');
    var authArea     = $('#auth-area');
    var notLoggedIn  = $('#not-logged-in');
    var mylinksSection = $('#mylinks-section');
    var mylinksList  = $('#mylinks-list');
    var linksSearch  = $('#links-search');
    var statsModal   = $('#stats-modal');
    var passwordModal = $('#password-modal');
    var passwordForm  = $('#password-form');
    var passwordError = $('#password-error');
    var paginationEl = $('#mylinks-pagination');

    // ── i18n ─────────────────────────────────────────────────
    function detectLanguage() {
        var saved = localStorage.getItem('lang');
        if (saved && SUPPORTED_LANGS.indexOf(saved) !== -1) return saved;
        var nav = navigator.language || navigator.userLanguage || '';
        for (var i = 0; i < SUPPORTED_LANGS.length; i++) {
            if (nav.toLowerCase().indexOf(SUPPORTED_LANGS[i].toLowerCase()) === 0) return SUPPORTED_LANGS[i];
            if (nav.toLowerCase().indexOf(SUPPORTED_LANGS[i].split('-')[0]) === 0) return SUPPORTED_LANGS[i];
        }
        return DEFAULT_LANG;
    }

    async function loadLanguage(code) {
        try {
            var res = await fetch('/i18n/' + code + '.json');
            if (!res.ok) throw new Error();
            lang = await res.json();
            langCode = code;
            localStorage.setItem('lang', code);
            document.documentElement.setAttribute('lang', code);
            applyTranslations();
            langIcon.textContent = (LANG_META[code] || {}).flag || lang.meta.flag;
        } catch (e) {
            if (code !== DEFAULT_LANG) await loadLanguage(DEFAULT_LANG);
        }
    }

    function t(key) {
        var parts = key.split('.');
        var val = lang;
        for (var i = 0; i < parts.length; i++) {
            if (val && typeof val === 'object') val = val[parts[i]];
            else return key;
        }
        return val || key;
    }

    function applyTranslations() {
        $$('[data-i18n]').forEach(function (el) { el.textContent = t(el.getAttribute('data-i18n')); });
        $$('[data-i18n-placeholder]').forEach(function (el) { el.setAttribute('placeholder', t(el.getAttribute('data-i18n-placeholder'))); });
        $$('[data-i18n-title]').forEach(function (el) { el.setAttribute('title', t(el.getAttribute('data-i18n-title'))); });
        renderAuthArea();
        if (currentUser && allUrls.length) renderMyUrls(allUrls);
    }

    var LANG_META = {
        'en':    { flag: '🇺🇸', name: 'English' },
        'pt-BR': { flag: '🇧🇷', name: 'Português (BR)' },
        'es':    { flag: '🇪🇸', name: 'Español' }
    };

    function renderLangMenu() {
        langMenu.innerHTML = SUPPORTED_LANGS.map(function (code) {
            var m = LANG_META[code] || { flag: '🌐', name: code };
            var active = code === langCode ? ' active' : '';
            var check = code === langCode ? '<span class="lang-option-check">✓</span>' : '';
            return '<button class="lang-option' + active + '" data-lang="' + code + '">' +
                '<span class="lang-option-flag">' + m.flag + '</span>' +
                '<span class="lang-option-name">' + m.name + '</span>' + check +
            '</button>';
        }).join('');
        langMenu.querySelectorAll('.lang-option').forEach(function (btn) {
            btn.addEventListener('click', function () {
                loadLanguage(btn.getAttribute('data-lang'));
                langDropdown.classList.remove('open');
                langMenu.classList.add('hidden');
            });
        });
    }

    langToggle.addEventListener('click', function (e) {
        e.stopPropagation();
        var isOpen = langDropdown.classList.contains('open');
        if (isOpen) { langDropdown.classList.remove('open'); langMenu.classList.add('hidden'); }
        else { renderLangMenu(); langDropdown.classList.add('open'); langMenu.classList.remove('hidden'); }
    });
    document.addEventListener('click', function () { langDropdown.classList.remove('open'); langMenu.classList.add('hidden'); });

    // ── Theme ────────────────────────────────────────────────
    function initTheme() {
        var saved = localStorage.getItem('theme');
        var prefer = saved || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
        setTheme(prefer);
    }
    function setTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('theme', theme);
        themeIcon.textContent = theme === 'dark' ? '☀️' : '🌙';
    }
    themeToggle.addEventListener('click', function () {
        var current = document.documentElement.getAttribute('data-theme');
        setTheme(current === 'dark' ? 'light' : 'dark');
    });

    // ── API helper ───────────────────────────────────────────
    async function api(method, path, body) {
        var opts = { method: method, headers: { 'Content-Type': 'application/json' }, credentials: 'include' };
        if (body) opts.body = JSON.stringify(body);
        var res = await fetch(API + path, opts);
        var data = await res.json().catch(function () { return {}; });
        if (!res.ok) throw new Error(data.error || t('toast.unknownError'));
        return data;
    }

    // ── Toast (variants) ─────────────────────────────────────
    var TOAST_ICONS = { success: '✓', error: '✕', info: 'ℹ' };
    function toast(msg, duration, type) {
        duration = duration || 2500;
        type = type || 'info';
        var el = document.createElement('div');
        el.className = 'toast toast-' + type;
        el.innerHTML = '<span class="toast-icon">' + (TOAST_ICONS[type] || '') + '</span><span></span>';
        el.querySelector('span:last-child').textContent = msg;
        document.body.appendChild(el);
        setTimeout(function () {
            el.classList.add('toast-leaving');
            setTimeout(function () { el.remove(); }, 200);
        }, duration);
    }

    // ── Confirm dialog ───────────────────────────────────────
    function confirmDialog(opts) {
        opts = opts || {};
        return new Promise(function (resolve) {
            var modal = document.createElement('div');
            modal.className = 'confirm-modal';
            var iconClass = opts.danger === false ? 'confirm-modal-icon info' : 'confirm-modal-icon';
            var icon = opts.danger === false ? 'ℹ' : '⚠';
            var confirmClass = opts.danger === false ? 'btn-primary' : 'btn-danger';
            var confirmLabel = opts.confirmText || t('common.confirm');
            var cancelLabel = opts.cancelText || t('common.cancel');
            modal.innerHTML =
                '<div class="confirm-modal-backdrop"></div>' +
                '<div class="confirm-modal-card" role="dialog" aria-modal="true">' +
                    '<div class="' + iconClass + '">' + icon + '</div>' +
                    '<h3 class="confirm-modal-title"></h3>' +
                    '<p class="confirm-modal-message"></p>' +
                    '<div class="confirm-modal-actions">' +
                        '<button type="button" class="btn-secondary" data-act="cancel"></button>' +
                        '<button type="button" class="' + confirmClass + '" data-act="confirm" style="padding:0.6rem 1.1rem"></button>' +
                    '</div>' +
                '</div>';
            modal.querySelector('.confirm-modal-title').textContent = opts.title || t('common.areYouSure');
            if (opts.message) modal.querySelector('.confirm-modal-message').textContent = opts.message;
            else modal.querySelector('.confirm-modal-message').style.display = 'none';
            modal.querySelector('[data-act="cancel"]').textContent = cancelLabel;
            modal.querySelector('[data-act="confirm"]').textContent = confirmLabel;

            document.body.appendChild(modal);
            var confirmBtn = modal.querySelector('[data-act="confirm"]');
            confirmBtn.focus();

            function close(result) {
                modal.remove();
                document.removeEventListener('keydown', onKey);
                resolve(result);
            }
            function onKey(e) {
                if (e.key === 'Escape') close(false);
                else if (e.key === 'Enter') close(true);
            }
            modal.querySelector('.confirm-modal-backdrop').addEventListener('click', function () { close(false); });
            modal.querySelector('[data-act="cancel"]').addEventListener('click', function () { close(false); });
            confirmBtn.addEventListener('click', function () { close(true); });
            document.addEventListener('keydown', onKey);
        });
    }

    // ── Skeleton loader ──────────────────────────────────────
    function renderSkeletonCards(count) {
        count = count || 4;
        var html = '';
        for (var i = 0; i < count; i++) {
            html += '<div class="skeleton-card">' +
                '<div class="skeleton-line med"></div>' +
                '<div class="skeleton-line long"></div>' +
                '<div class="skeleton-line short"></div>' +
            '</div>';
        }
        mylinksList.innerHTML = html;
    }

    // ── Empty state (SVG) ────────────────────────────────────
    var EMPTY_SVG =
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
            '<path d="M40 56l-8 8a14 14 0 1 1-20-20l12-12a14 14 0 0 1 20 0"/>' +
            '<path d="M56 40l8-8a14 14 0 1 1 20 20L72 64a14 14 0 0 1-20 0"/>' +
            '<path d="M36 60l24-24" stroke-dasharray="4 4"/>' +
        '</svg>';

    function renderEmptyState(filtered) {
        var titleKey = filtered ? 'empty.noLinksFilteredTitle' : 'empty.noLinksTitle';
        var descKey  = filtered ? 'empty.noLinksFilteredDesc'  : 'empty.noLinksDesc';
        mylinksList.innerHTML =
            '<div class="empty-state">' +
                '<div class="empty-state-icon">' + EMPTY_SVG + '</div>' +
                '<h3 class="empty-state-title">' + escapeHtml(t(titleKey)) + '</h3>' +
                '<p class="empty-state-desc">' + escapeHtml(t(descKey)) + '</p>' +
            '</div>';
    }

    // ── Escape helpers ───────────────────────────────────────
    function escapeHtml(str) { var d = document.createElement('div'); d.appendChild(document.createTextNode(String(str))); return d.innerHTML; }
    function escapeAttr(str) { return str.replace(/&/g, '&amp;').replace(/'/g, '&#39;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

    // ── Date helpers (server stores UTC 'Y-m-d H:i:s') ───────
    function parseServerUtc(str) {
        if (!str) return null;
        // Interpret as UTC regardless of local browser TZ
        return new Date(str.replace(' ', 'T') + 'Z');
    }
    function formatLocalDateTime(str) {
        var d = parseServerUtc(str);
        if (!d) return '';
        return d.toLocaleString(langCode || undefined, {
            year: 'numeric', month: 'short', day: 'numeric',
            hour: '2-digit', minute: '2-digit'
        });
    }

    // ── Auth UI ──────────────────────────────────────────────
    function renderAuthArea() {
        if (currentUser) {
            authArea.innerHTML =
                '<span style="font-size:0.9rem;color:var(--text-secondary)">' + escapeHtml(currentUser.email) + '</span>' +
                '<button class="btn-secondary btn-small" id="change-pw-btn" title="' + escapeHtml(t('auth.changePasswordLink')) + '">🔒</button>' +
                '<button class="btn-secondary btn-small" id="logout-btn">' + escapeHtml(t('auth.logoutBtn')) + '</button>';
            $('#change-pw-btn').addEventListener('click', function () { passwordModal.classList.remove('hidden'); });
            $('#logout-btn').addEventListener('click', handleLogout);
        } else {
            authArea.innerHTML = '';
        }
    }

    // ── Password change ──────────────────────────────────────
    passwordForm.addEventListener('submit', async function (e) {
        e.preventDefault();
        passwordError.classList.add('hidden');
        var currentPw = passwordForm.current_password.value;
        var newPw = passwordForm.new_password.value;
        var confirmPw = passwordForm.confirm_password.value;
        if (newPw !== confirmPw) { passwordError.textContent = t('auth.passwordMismatch'); passwordError.classList.remove('hidden'); return; }
        try {
            await api('PUT', '/password', { current_password: currentPw, new_password: newPw });
            passwordModal.classList.add('hidden'); passwordForm.reset();
            toast(t('toast.passwordChanged'), 2500, 'success');
        } catch (err) { passwordError.textContent = err.message; passwordError.classList.remove('hidden'); }
    });
    $$('[data-close-password]').forEach(function (el) {
        el.addEventListener('click', function () { passwordModal.classList.add('hidden'); passwordForm.reset(); passwordError.classList.add('hidden'); });
    });

    async function handleLogout() {
        try { await api('POST', '/logout'); } catch (_) {}
        currentUser = null;
        window.location.href = '/';
    }

    // ── Load My URLs ─────────────────────────────────────────
    var firstLoad = true;
    async function loadMyUrls() {
        if (firstLoad) {
            renderSkeletonCards(3);
            firstLoad = false;
        }
        try {
            var qs = '?page=' + currentPage + '&per_page=' + perPage;
            if (currentSearch) qs += '&q=' + encodeURIComponent(currentSearch);
            var resp = await api('GET', '/my-urls' + qs);
            allUrls = resp.data || [];
            totalUrls = resp.total || 0;
            renderMyUrls(allUrls);
            renderPagination();
        } catch (err) {
            mylinksList.innerHTML = '';
            toast(err.message, 4000, 'error');
        }
    }

    function renderPagination() {
        if (!paginationEl) return;
        var totalPages = Math.max(1, Math.ceil(totalUrls / perPage));
        if (totalUrls <= perPage) { paginationEl.innerHTML = ''; return; }
        var prev = currentPage > 1
            ? '<button class="btn-secondary btn-small" id="page-prev">←</button>'
            : '<button class="btn-secondary btn-small" disabled>←</button>';
        var next = currentPage < totalPages
            ? '<button class="btn-secondary btn-small" id="page-next">→</button>'
            : '<button class="btn-secondary btn-small" disabled>→</button>';
        paginationEl.innerHTML = prev +
            '<span class="page-info">' + currentPage + ' / ' + totalPages + ' · ' + totalUrls + '</span>' +
            next;
        var pp = $('#page-prev'); if (pp) pp.addEventListener('click', function () { currentPage--; loadMyUrls(); });
        var pn = $('#page-next'); if (pn) pn.addEventListener('click', function () { currentPage++; loadMyUrls(); });
    }

    function renderMyUrls(urls) {
        if (!urls.length) {
            renderEmptyState(!!currentSearch);
            return;
        }

        mylinksList.innerHTML = urls.map(function (u) {
            var exp = u.expires_at
                ? '<span class="badge">⏱ ' + escapeHtml(t('myUrls.expires')) + ' ' + escapeHtml(formatLocalDateTime(u.expires_at)) + '</span>'
                : '<span class="badge">∞ ' + escapeHtml(t('myUrls.noExpiration')) + '</span>';
            var shortCode = (u.short_url || '').split('/').pop();
            return '<div class="url-card" data-id="' + u.id + '">' +
                '<div class="url-card-info">' +
                    '<a class="short" href="' + escapeHtml(u.short_url) + '" target="_blank" rel="noopener">' + escapeHtml(u.short_url) + '</a>' +
                    '<span class="original" title="' + escapeHtml(u.original_url) + '">' + escapeHtml(u.original_url) + '</span>' +
                    '<span class="meta">' + exp + '<span class="badge">👆 ' + u.clicks + ' ' + escapeHtml(t('myUrls.clicks')) + '</span></span>' +
                '</div>' +
                '<div class="url-card-actions">' +
                    '<button class="btn-icon-sm" onclick="window.__copyUrl(\'' + escapeHtml(u.short_url) + '\')" title="' + escapeHtml(t('myUrls.copyBtn')) + '">📋</button>' +
                    '<button class="btn-icon-sm" onclick="window.__editUrl(' + u.id + ', \'' + escapeAttr(u.original_url) + '\', \'' + escapeAttr(shortCode) + '\')" title="' + escapeHtml(t('myUrls.editBtn')) + '">✏️</button>' +
                    '<button class="btn-icon-sm" onclick="window.__showQr(\'' + escapeHtml(u.short_url) + '\')" title="' + escapeHtml(t('myUrls.qrBtn')) + '">📱</button>' +
                    '<button class="btn-icon-sm" onclick="window.__showStats(' + u.id + ')" title="' + escapeHtml(t('myLinks.statsBtn')) + '">📊</button>' +
                    '<button class="btn-icon-sm danger" onclick="window.__deleteUrl(' + u.id + ')" title="' + escapeHtml(t('myUrls.deleteBtn')) + '">🗑️</button>' +
                '</div>' +
            '</div>';
        }).join('');
    }

    // ── Search / Filter (server-side, debounced) ─────────────
    linksSearch.addEventListener('input', function () {
        clearTimeout(searchDebounce);
        searchDebounce = setTimeout(function () {
            currentSearch = linksSearch.value.trim();
            currentPage = 1;
            loadMyUrls();
        }, 250);
    });

    // ── Global actions ───────────────────────────────────────
    window.__copyUrl = function (url) {
        navigator.clipboard.writeText(url).then(function () { toast(t('toast.copied'), 2500, 'success'); });
    };

    window.__editUrl = function (id, currentUrl, currentAlias) {
        var card = document.querySelector('.url-card[data-id="' + id + '"]');
        if (!card || card.querySelector('.edit-inline')) return;
        var editDiv = document.createElement('div');
        editDiv.className = 'edit-inline';
        editDiv.innerHTML =
            '<form class="edit-inline-form" novalidate>' +
                '<div class="edit-inline-field">' +
                    '<label>' + escapeHtml(t('myUrls.editUrlLabel')) + '</label>' +
                    '<input type="url" class="edit-url-input" value="' + escapeAttr(currentUrl) + '" placeholder="' + escapeHtml(t('myUrls.editUrlPlaceholder')) + '" required>' +
                '</div>' +
                '<div class="edit-inline-field">' +
                    '<label>' + escapeHtml(t('myUrls.editAliasLabel')) + '</label>' +
                    '<input type="text" class="edit-alias-input" value="' + escapeAttr(currentAlias || '') + '" placeholder="' + escapeHtml(t('myUrls.editAliasPlaceholder')) + '" pattern="[a-zA-Z0-9_\\-]+">' +
                    '<small class="form-hint" style="margin-top:0.15rem">' + escapeHtml(t('myUrls.editAliasHint')) + '</small>' +
                '</div>' +
                '<div class="edit-inline-actions">' +
                    '<button type="button" class="btn-secondary btn-small edit-cancel-btn">' + escapeHtml(t('myUrls.editCancel')) + '</button>' +
                    '<button type="submit" class="btn-primary btn-small edit-save-btn">' + escapeHtml(t('myUrls.editSave')) + '</button>' +
                '</div>' +
            '</form>';
        card.appendChild(editDiv);
        var urlInput = editDiv.querySelector('.edit-url-input');
        var aliasInput = editDiv.querySelector('.edit-alias-input');
        urlInput.focus(); urlInput.select();

        editDiv.querySelector('form').addEventListener('submit', async function (e) {
            e.preventDefault();
            var newUrl = urlInput.value.trim();
            var newAlias = aliasInput.value.trim();
            if (!newUrl) return;
            var body = { url: newUrl };
            if (newAlias && newAlias !== (currentAlias || '')) body.alias = newAlias;
            try {
                await api('PUT', '/urls/' + id, body);
                toast(t('toast.updated'), 2500, 'success');
                loadMyUrls();
            } catch (err) {
                toast(err.message, 4000, 'error');
            }
        });
        editDiv.querySelector('.edit-cancel-btn').addEventListener('click', function () { editDiv.remove(); });
    };

    window.__showQr = function (shortUrl) {
        var code = shortUrl.split('/').pop();
        window.open('/qr/' + code, '_blank');
    };

    window.__deleteUrl = async function (id) {
        var ok = await confirmDialog({
            title: t('myUrls.confirmDelete'),
            message: t('myUrls.confirmDeleteDesc'),
            confirmText: t('common.delete')
        });
        if (!ok) return;
        try { await api('DELETE', '/urls/' + id); toast(t('toast.deleted'), 2500, 'success'); loadMyUrls(); }
        catch (err) { toast(err.message, 4000, 'error'); }
    };

    // ── Stats Modal ──────────────────────────────────────────
    window.__showStats = async function (id) {
        try {
            var data = await api('GET', '/urls/' + id + '/stats');
            renderStats(data);
            statsModal.classList.remove('hidden');
        } catch (err) {
            toast(err.message, 4000, 'error');
        }
    };

    $$('[data-close-stats]').forEach(function (el) {
        el.addEventListener('click', function () { statsModal.classList.add('hidden'); });
    });

    function renderStats(data) {
        $('#stats-total-count').textContent = data.total_clicks;

        // Bar chart
        var chart = $('#stats-chart');
        if (!data.clicks_by_day.length) {
            chart.innerHTML = '<p style="color:var(--text-secondary);padding:1rem 0">' + escapeHtml(t('myLinks.noData')) + '</p>';
        } else {
            var maxCount = Math.max.apply(null, data.clicks_by_day.map(function (d) { return d.count; }));
            chart.innerHTML = data.clicks_by_day.map(function (d) {
                var pct = maxCount > 0 ? Math.round((d.count / maxCount) * 100) : 0;
                return '<div class="stats-bar-row">' +
                    '<span class="stats-bar-label">' + escapeHtml(d.day) + '</span>' +
                    '<div class="stats-bar-track"><div class="stats-bar-fill" style="width:' + pct + '%"></div></div>' +
                    '<span class="stats-bar-count">' + d.count + '</span>' +
                '</div>';
            }).join('');
        }

        // Referers
        var refList = $('#stats-referers');
        if (!data.top_referers.length) {
            refList.innerHTML = '<li style="color:var(--text-secondary)">' + escapeHtml(t('myLinks.noData')) + '</li>';
        } else {
            refList.innerHTML = data.top_referers.map(function (r) {
                return '<li><span class="ref-name">' + escapeHtml(r.referer) + '</span><span class="ref-count">' + r.count + '</span></li>';
            }).join('');
        }
    }

    // ── Online / offline indicator ───────────────────────────
    var offlineBanner = null;
    function showOfflineBanner() {
        if (offlineBanner) return;
        offlineBanner = document.createElement('div');
        offlineBanner.className = 'offline-banner';
        offlineBanner.textContent = t('toast.offline');
        document.body.appendChild(offlineBanner);
    }
    function hideOfflineBanner() {
        if (!offlineBanner) return;
        offlineBanner.remove();
        offlineBanner = null;
        toast(t('toast.backOnline'), 2000, 'success');
    }
    window.addEventListener('online',  hideOfflineBanner);
    window.addEventListener('offline', showOfflineBanner);
    if (!navigator.onLine) showOfflineBanner();

    // ── Service worker ───────────────────────────────────────
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', function () {
            navigator.serviceWorker.register('/sw.js').catch(function () { /* ignore */ });
        });
    }

    // ── Init ─────────────────────────────────────────────────
    initTheme();
    loadLanguage(detectLanguage()).then(async function () {
        try {
            var data = await api('GET', '/me');
            currentUser = data.user;
            renderAuthArea();
            notLoggedIn.classList.add('hidden');
            mylinksSection.classList.remove('hidden');
            loadMyUrls();
        } catch (_) {
            currentUser = null;
            renderAuthArea();
            notLoggedIn.classList.remove('hidden');
            mylinksSection.classList.add('hidden');
        }
    });
})();
