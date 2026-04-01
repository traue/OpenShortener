(function () {
    'use strict';

    // ── Config ───────────────────────────────────────────────
    var API = '/api/v1';
    var SUPPORTED_LANGS = ['en', 'pt-BR'];
    var DEFAULT_LANG = 'en';

    // ── State ────────────────────────────────────────────────
    var adminUser = null;
    var lang = {};
    var langCode = '';
    var usersData = [];
    var urlsData = [];

    // ── DOM refs ─────────────────────────────────────────────
    var $ = function (sel) { return document.querySelector(sel); };
    var $$ = function (sel) { return document.querySelectorAll(sel); };

    var langToggle   = $('#lang-toggle');
    var langIcon     = $('#lang-icon');
    var themeToggle  = $('#theme-toggle');
    var themeIcon    = $('#theme-icon');
    var adminArea    = $('#admin-area');
    var loginSection = $('#admin-login');
    var dashboard    = $('#admin-dashboard');
    var loginForm    = $('#admin-login-form');
    var loginError   = $('#admin-login-error');
    var usersTbody   = $('#users-tbody');
    var urlsTbody    = $('#urls-tbody');
    var usersCount   = $('#users-count');
    var urlsCount    = $('#urls-count');
    var usersEmpty   = $('#users-empty');
    var urlsEmpty    = $('#urls-empty');
    var usersSearch  = $('#users-search');
    var urlsSearch   = $('#urls-search');

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
            langIcon.textContent = lang.meta.flag;
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
        $$('[data-i18n]').forEach(function (el) {
            el.textContent = t(el.getAttribute('data-i18n'));
        });
        $$('[data-i18n-placeholder]').forEach(function (el) {
            el.setAttribute('placeholder', t(el.getAttribute('data-i18n-placeholder')));
        });
        $$('[data-i18n-title]').forEach(function (el) {
            el.setAttribute('title', t(el.getAttribute('data-i18n-title')));
        });
        // Re-render tables with new translations
        if (adminUser) {
            renderUsersTable(usersData);
            renderUrlsTable(urlsData);
        }
    }

    langToggle.addEventListener('click', function () {
        var idx = SUPPORTED_LANGS.indexOf(langCode);
        var next = SUPPORTED_LANGS[(idx + 1) % SUPPORTED_LANGS.length];
        loadLanguage(next);
    });

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
        var opts = {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
        };
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
    function escapeHtml(str) {
        var div = document.createElement('div');
        div.appendChild(document.createTextNode(String(str)));
        return div.innerHTML;
    }

    function formatDate(dateStr) {
        if (!dateStr) return '—';
        var d = new Date(dateStr.replace(' ', 'T'));
        return d.toLocaleDateString(langCode, { year: 'numeric', month: 'short', day: 'numeric' });
    }

    // ── Auth ─────────────────────────────────────────────────
    function showDashboard() {
        loginSection.classList.add('hidden');
        dashboard.classList.remove('hidden');
        adminArea.innerHTML =
            '<span style="font-size:0.9rem;color:var(--text-secondary)">' + escapeHtml(adminUser.username) + '</span>' +
            '<button class="btn-secondary btn-small" id="admin-logout-btn">' + escapeHtml(t('auth.logoutBtn')) + '</button>';
        $('#admin-logout-btn').addEventListener('click', handleLogout);
        loadAllData();
    }

    function showLogin() {
        loginSection.classList.remove('hidden');
        dashboard.classList.add('hidden');
        adminArea.innerHTML = '';
    }

    loginForm.addEventListener('submit', async function (e) {
        e.preventDefault();
        loginError.classList.add('hidden');
        var username = loginForm.username.value.trim();
        var password = loginForm.password.value;
        try {
            var data = await api('POST', '/admin/login', { username: username, password: password });
            adminUser = data.admin;
            loginForm.reset();
            showDashboard();
        } catch (err) {
            loginError.textContent = err.message;
            loginError.classList.remove('hidden');
        }
    });

    async function handleLogout() {
        try { await api('POST', '/logout'); } catch (_) {}
        adminUser = null;
        usersData = [];
        urlsData = [];
        showLogin();
        toast(t('toast.logoutSuccess'));
    }

    // ── Check existing session ───────────────────────────────
    async function checkSession() {
        try {
            var users = await api('GET', '/admin/users');
            // If we get here, session is valid
            adminUser = { username: 'admin' };
            usersData = users;
            showDashboard();
            return true;
        } catch (_) {
            showLogin();
            return false;
        }
    }

    // ── Load data ────────────────────────────────────────────
    async function loadAllData() {
        await Promise.all([loadUsers(), loadUrls()]);
    }

    async function loadUsers() {
        try {
            usersData = await api('GET', '/admin/users');
            usersCount.textContent = usersData.length;
            renderUsersTable(usersData);
        } catch (err) {
            if (err.message === 'Unauthorized') { showLogin(); return; }
            toast(err.message, 4000);
        }
    }

    async function loadUrls() {
        try {
            urlsData = await api('GET', '/admin/urls');
            urlsCount.textContent = urlsData.length;
            renderUrlsTable(urlsData);
        } catch (err) {
            if (err.message === 'Unauthorized') { showLogin(); return; }
            toast(err.message, 4000);
        }
    }

    // ── Render Users ─────────────────────────────────────────
    function renderUsersTable(users) {
        if (!users.length) {
            usersEmpty.classList.remove('hidden');
            usersTbody.innerHTML = '';
            return;
        }
        usersEmpty.classList.add('hidden');

        usersTbody.innerHTML = users.map(function (u) {
            var isActive = Number(u.is_active) === 1;
            var statusClass = isActive ? 'status-active' : 'status-blocked';
            var statusText = isActive ? t('admin.statusActive') : t('admin.statusBlocked');
            var toggleLabel = isActive ? t('admin.blockBtn') : t('admin.unblockBtn');
            var toggleIcon = isActive ? '🚫' : '✅';

            return '<tr>' +
                '<td class="col-id">' + u.id + '</td>' +
                '<td>' + escapeHtml(u.email) + '</td>' +
                '<td><span class="status-badge ' + statusClass + '">' + escapeHtml(statusText) + '</span></td>' +
                '<td class="col-date">' + formatDate(u.created_at) + '</td>' +
                '<td class="col-actions">' +
                    '<button class="btn-icon-sm" onclick="window.__toggleUser(' + u.id + ', ' + (isActive ? 'false' : 'true') + ')" title="' + escapeHtml(toggleLabel) + '">' + toggleIcon + '</button>' +
                    '<button class="btn-icon-sm danger" onclick="window.__deleteUser(' + u.id + ', \'' + escapeHtml(u.email) + '\')" title="' + escapeHtml(t('admin.deleteBtn')) + '">🗑️</button>' +
                '</td>' +
            '</tr>';
        }).join('');
    }

    // ── Render URLs ──────────────────────────────────────────
    function renderUrlsTable(urls) {
        if (!urls.length) {
            urlsEmpty.classList.remove('hidden');
            urlsTbody.innerHTML = '';
            return;
        }
        urlsEmpty.classList.add('hidden');

        urlsTbody.innerHTML = urls.map(function (u) {
            var exp = u.expires_at ? formatDate(u.expires_at) : '∞';
            var owner = u.user_id ? '#' + u.user_id : '—';

            return '<tr>' +
                '<td class="col-id">' + u.id + '</td>' +
                '<td class="col-url">' +
                    '<a href="' + escapeHtml(u.original_url) + '" target="_blank" rel="noopener" title="' + escapeHtml(u.original_url) + '">' +
                        escapeHtml(u.original_url.length > 50 ? u.original_url.substring(0, 50) + '…' : u.original_url) +
                    '</a>' +
                '</td>' +
                '<td><a href="' + escapeHtml(u.short_url) + '" target="_blank" rel="noopener" class="short-link">' + escapeHtml(u.short_url) + '</a></td>' +
                '<td class="col-owner">' + escapeHtml(owner) + '</td>' +
                '<td class="col-clicks">' + u.clicks + '</td>' +
                '<td class="col-date">' + exp + '</td>' +
                '<td class="col-date">' + formatDate(u.created_at) + '</td>' +
                '<td class="col-actions">' +
                    '<button class="btn-icon-sm" onclick="window.__copyAdminUrl(\'' + escapeHtml(u.short_url) + '\')" title="' + escapeHtml(t('myUrls.copyBtn')) + '">📋</button>' +
                    '<button class="btn-icon-sm danger" onclick="window.__deleteAdminUrl(' + u.id + ')" title="' + escapeHtml(t('admin.deleteBtn')) + '">🗑️</button>' +
                '</td>' +
            '</tr>';
        }).join('');
    }

    // ── Admin Actions (global) ───────────────────────────────
    window.__toggleUser = async function (id, activate) {
        try {
            await api('PUT', '/admin/users/' + id, { is_active: activate });
            toast(activate ? t('admin.userActivated') : t('admin.userBlocked'));
            loadUsers();
        } catch (err) {
            toast(err.message, 4000);
        }
    };

    window.__deleteUser = async function (id, email) {
        if (!confirm(t('admin.confirmDeleteUser').replace('{email}', email))) return;
        try {
            await api('DELETE', '/admin/users/' + id);
            toast(t('toast.deleted'));
            loadUsers();
        } catch (err) {
            toast(err.message, 4000);
        }
    };

    window.__deleteAdminUrl = async function (id) {
        if (!confirm(t('admin.confirmDeleteUrl'))) return;
        try {
            await api('DELETE', '/admin/urls/' + id);
            toast(t('toast.deleted'));
            loadUrls();
        } catch (err) {
            toast(err.message, 4000);
        }
    };

    window.__copyAdminUrl = function (url) {
        navigator.clipboard.writeText(url).then(function () { toast(t('toast.copied')); });
    };

    // ── Tabs ─────────────────────────────────────────────────
    $$('.admin-tab').forEach(function (tab) {
        tab.addEventListener('click', function () {
            $$('.admin-tab').forEach(function (t) { t.classList.remove('active'); });
            tab.classList.add('active');
            var panel = tab.getAttribute('data-panel');
            $$('.admin-panel').forEach(function (p) { p.classList.add('hidden'); });
            $('#panel-' + panel).classList.remove('hidden');
        });
    });

    // ── Search / Filter ──────────────────────────────────────
    usersSearch.addEventListener('input', function () {
        var q = usersSearch.value.toLowerCase().trim();
        if (!q) { renderUsersTable(usersData); return; }
        var filtered = usersData.filter(function (u) {
            return u.email.toLowerCase().indexOf(q) !== -1 || String(u.id).indexOf(q) !== -1;
        });
        renderUsersTable(filtered);
    });

    urlsSearch.addEventListener('input', function () {
        var q = urlsSearch.value.toLowerCase().trim();
        if (!q) { renderUrlsTable(urlsData); return; }
        var filtered = urlsData.filter(function (u) {
            return u.original_url.toLowerCase().indexOf(q) !== -1 ||
                   u.short_code.toLowerCase().indexOf(q) !== -1 ||
                   String(u.id).indexOf(q) !== -1;
        });
        renderUrlsTable(filtered);
    });

    // ── Init ─────────────────────────────────────────────────
    initTheme();
    loadLanguage(detectLanguage()).then(function () {
        checkSession();
    });
})();
