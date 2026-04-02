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

    // ── Toast ────────────────────────────────────────────────
    function toast(msg, duration) {
        duration = duration || 2500;
        var el = document.createElement('div');
        el.className = 'toast';
        el.textContent = msg;
        document.body.appendChild(el);
        setTimeout(function () { el.remove(); }, duration);
    }

    // ── Escape helpers ───────────────────────────────────────
    function escapeHtml(str) { var d = document.createElement('div'); d.appendChild(document.createTextNode(String(str))); return d.innerHTML; }
    function escapeAttr(str) { return str.replace(/&/g, '&amp;').replace(/'/g, '&#39;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

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
            toast(t('toast.passwordChanged'));
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
    async function loadMyUrls() {
        try {
            allUrls = await api('GET', '/my-urls');
            renderMyUrls(allUrls);
        } catch (_) {}
    }

    function renderMyUrls(urls) {
        if (!urls.length) {
            mylinksList.innerHTML = '<p style="color:var(--text-secondary);text-align:center;padding:2rem 0">' + escapeHtml(t('myUrls.empty')) + '</p>';
            return;
        }

        mylinksList.innerHTML = urls.map(function (u) {
            var exp = u.expires_at
                ? '<span class="badge">⏱ ' + escapeHtml(t('myUrls.expires')) + ' ' + escapeHtml(u.expires_at) + '</span>'
                : '<span class="badge">∞ ' + escapeHtml(t('myUrls.noExpiration')) + '</span>';
            return '<div class="url-card" data-id="' + u.id + '">' +
                '<div class="url-card-info">' +
                    '<a class="short" href="' + escapeHtml(u.short_url) + '" target="_blank" rel="noopener">' + escapeHtml(u.short_url) + '</a>' +
                    '<span class="original" title="' + escapeHtml(u.original_url) + '">' + escapeHtml(u.original_url) + '</span>' +
                    '<span class="meta">' + exp + '<span class="badge">👆 ' + u.clicks + ' ' + escapeHtml(t('myUrls.clicks')) + '</span></span>' +
                '</div>' +
                '<div class="url-card-actions">' +
                    '<button class="btn-icon-sm" onclick="window.__copyUrl(\'' + escapeHtml(u.short_url) + '\')" title="' + escapeHtml(t('myUrls.copyBtn')) + '">📋</button>' +
                    '<button class="btn-icon-sm" onclick="window.__editUrl(' + u.id + ', \'' + escapeAttr(u.original_url) + '\')" title="' + escapeHtml(t('myUrls.editBtn')) + '">✏️</button>' +
                    '<button class="btn-icon-sm" onclick="window.__showQr(\'' + escapeHtml(u.short_url) + '\')" title="' + escapeHtml(t('myUrls.qrBtn')) + '">📱</button>' +
                    '<button class="btn-icon-sm" onclick="window.__showStats(' + u.id + ')" title="' + escapeHtml(t('myLinks.statsBtn')) + '">📊</button>' +
                    '<button class="btn-icon-sm danger" onclick="window.__deleteUrl(' + u.id + ')" title="' + escapeHtml(t('myUrls.deleteBtn')) + '">🗑️</button>' +
                '</div>' +
            '</div>';
        }).join('');
    }

    // ── Search / Filter ──────────────────────────────────────
    linksSearch.addEventListener('input', function () {
        var q = linksSearch.value.toLowerCase().trim();
        if (!q) { renderMyUrls(allUrls); return; }
        var filtered = allUrls.filter(function (u) {
            return u.original_url.toLowerCase().indexOf(q) !== -1 ||
                   u.short_url.toLowerCase().indexOf(q) !== -1;
        });
        renderMyUrls(filtered);
    });

    // ── Global actions ───────────────────────────────────────
    window.__copyUrl = function (url) {
        navigator.clipboard.writeText(url).then(function () { toast(t('toast.copied')); });
    };

    window.__editUrl = function (id, currentUrl) {
        var card = document.querySelector('.url-card[data-id="' + id + '"]');
        if (!card || card.querySelector('.edit-inline')) return;
        var editDiv = document.createElement('div');
        editDiv.className = 'edit-inline';
        editDiv.innerHTML =
            '<div style="display:flex;gap:0.5rem;margin-top:0.5rem;width:100%">' +
                '<input type="url" class="edit-url-input" value="' + escapeAttr(currentUrl) + '" placeholder="' + escapeHtml(t('myUrls.editUrlPlaceholder')) + '" style="flex:1">' +
                '<button class="btn-primary btn-small edit-save-btn">' + escapeHtml(t('myUrls.editSave')) + '</button>' +
                '<button class="btn-secondary btn-small edit-cancel-btn">' + escapeHtml(t('myUrls.editCancel')) + '</button>' +
            '</div>';
        card.appendChild(editDiv);
        var input = editDiv.querySelector('.edit-url-input');
        input.focus(); input.select();
        editDiv.querySelector('.edit-save-btn').addEventListener('click', async function () {
            var newUrl = input.value.trim();
            if (!newUrl) return;
            try { await api('PUT', '/urls/' + id, { url: newUrl }); toast(t('toast.updated')); loadMyUrls(); }
            catch (err) { toast(err.message, 4000); }
        });
        editDiv.querySelector('.edit-cancel-btn').addEventListener('click', function () { editDiv.remove(); });
    };

    window.__showQr = function (shortUrl) {
        var code = shortUrl.split('/').pop();
        window.open('/qr/' + code, '_blank');
    };

    window.__deleteUrl = async function (id) {
        if (!confirm(t('myUrls.confirmDelete'))) return;
        try { await api('DELETE', '/urls/' + id); toast(t('toast.deleted')); loadMyUrls(); }
        catch (err) { toast(err.message, 4000); }
    };

    // ── Stats Modal ──────────────────────────────────────────
    window.__showStats = async function (id) {
        try {
            var data = await api('GET', '/urls/' + id + '/stats');
            renderStats(data);
            statsModal.classList.remove('hidden');
        } catch (err) {
            toast(err.message, 4000);
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
