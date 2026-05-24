(function () {
    'use strict';

    // ── Config ───────────────────────────────────────────────
    var API = '/api/v1';
    var SUPPORTED_LANGS = ['en', 'pt-BR', 'es'];
    var DEFAULT_LANG = 'en';

    // ── State ────────────────────────────────────────────────
    var adminUser = null;
    var lang = {};
    var langCode = '';
    var usersData = [];
    var urlsData = [];
    var urlsPage = 1;
    var urlsPerPage = 25;
    var urlsTotal = 0;
    var urlsCurrentSearch = '';
    var urlsSearchDebounce = null;

    // ── DOM refs ─────────────────────────────────────────────
    var $ = function (sel) { return document.querySelector(sel); };
    var $$ = function (sel) { return document.querySelectorAll(sel); };

    var langToggle   = $('#lang-toggle');
    var langIcon     = $('#lang-icon');
    var langMenu     = $('#lang-menu');
    var langDropdown = langToggle.closest('.lang-dropdown');
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
    var urlsPagination = $('#urls-pagination');

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

    // ── Language metadata ────────────────────────────────────
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
                '<span class="lang-option-name">' + m.name + '</span>' +
                check +
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
        if (isOpen) {
            langDropdown.classList.remove('open');
            langMenu.classList.add('hidden');
        } else {
            renderLangMenu();
            langDropdown.classList.add('open');
            langMenu.classList.remove('hidden');
        }
    });

    document.addEventListener('click', function () {
        langDropdown.classList.remove('open');
        langMenu.classList.add('hidden');
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

    // ── Skeleton rows for admin tables ───────────────────────
    function renderSkeletonRows(tbody, columnCount, rows) {
        rows = rows || 4;
        var cells = '';
        for (var c = 0; c < columnCount; c++) {
            cells += '<td><div class="skeleton-line ' + (c === 1 ? 'long' : c === 0 ? 'short' : 'med') + '"></div></td>';
        }
        var html = '';
        for (var i = 0; i < rows; i++) html += '<tr class="skeleton-row">' + cells + '</tr>';
        tbody.innerHTML = html;
    }

    // ── Empty state ──────────────────────────────────────────
    var EMPTY_LINK_SVG =
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
            '<path d="M40 56l-8 8a14 14 0 1 1-20-20l12-12a14 14 0 0 1 20 0"/>' +
            '<path d="M56 40l8-8a14 14 0 1 1 20 20L72 64a14 14 0 0 1-20 0"/>' +
            '<path d="M36 60l24-24" stroke-dasharray="4 4"/>' +
        '</svg>';
    var EMPTY_USER_SVG =
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
            '<circle cx="48" cy="36" r="14"/>' +
            '<path d="M20 80c0-14 12-24 28-24s28 10 28 24"/>' +
        '</svg>';

    function renderEmptyState(el, svg, title, desc) {
        el.innerHTML =
            '<div class="empty-state">' +
                '<div class="empty-state-icon">' + svg + '</div>' +
                '<h3 class="empty-state-title">' + escapeHtml(title) + '</h3>' +
                '<p class="empty-state-desc">' + escapeHtml(desc) + '</p>' +
            '</div>';
    }

    // ── Bulk selection state ─────────────────────────────────
    var selectedUsers = new Set();
    var selectedUrls  = new Set();

    function clearSelection(kind) {
        if (kind === 'users') selectedUsers.clear();
        if (kind === 'urls')  selectedUrls.clear();
        renderBulkBar();
    }

    // ── Export helpers ───────────────────────────────────────
    function toCsv(rows) {
        if (!rows.length) return '';
        var headers = Object.keys(rows[0]);
        var esc = function (v) {
            if (v === null || v === undefined) return '';
            var s = String(v);
            if (/[",\n\r]/.test(s)) s = '"' + s.replace(/"/g, '""') + '"';
            return s;
        };
        var lines = [headers.map(esc).join(',')];
        rows.forEach(function (r) { lines.push(headers.map(function (h) { return esc(r[h]); }).join(',')); });
        return lines.join('\r\n');
    }

    function downloadBlob(content, mime, filename) {
        var blob = new Blob([content], { type: mime + ';charset=utf-8' });
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url; a.download = filename;
        document.body.appendChild(a); a.click();
        setTimeout(function () { document.body.removeChild(a); URL.revokeObjectURL(url); }, 100);
    }

    function timestamp() {
        var d = new Date(), pad = function (n) { return n < 10 ? '0' + n : '' + n; };
        return d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate()) + '-' +
               pad(d.getHours()) + pad(d.getMinutes()) + pad(d.getSeconds());
    }

    // ── Escape helpers ───────────────────────────────────────
    function escapeHtml(str) {
        var div = document.createElement('div');
        div.appendChild(document.createTextNode(String(str)));
        return div.innerHTML;
    }

    function parseServerUtc(str) {
        if (!str) return null;
        return new Date(str.replace(' ', 'T') + 'Z');
    }
    function formatDate(dateStr) {
        var d = parseServerUtc(dateStr);
        if (!d) return '—';
        return d.toLocaleDateString(langCode || undefined, { year: 'numeric', month: 'short', day: 'numeric' });
    }
    function formatDateTime(dateStr) {
        var d = parseServerUtc(dateStr);
        if (!d) return '—';
        return d.toLocaleString(langCode || undefined, {
            year: 'numeric', month: 'short', day: 'numeric',
            hour: '2-digit', minute: '2-digit'
        });
    }
    // datetime-local input displays local time — convert UTC server value → local YYYY-MM-DDTHH:MM
    function serverUtcToLocalInput(str) {
        var d = parseServerUtc(str);
        if (!d) return '';
        var pad = function (n) { return n < 10 ? '0' + n : '' + n; };
        return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) +
            'T' + pad(d.getHours()) + ':' + pad(d.getMinutes());
    }

    // ── Auth ─────────────────────────────────────────────────
    function showDashboard() {
        loginSection.classList.add('hidden');
        dashboard.classList.remove('hidden');
        adminArea.innerHTML =
            '<span style="font-size:0.9rem;color:var(--text-secondary)">' + escapeHtml(adminUser.email) + '</span>' +
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
        var email = loginForm.email.value.trim();
        var password = loginForm.password.value;
        try {
            var data = await api('POST', '/admin/login', { email: email, password: password });
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
        toast(t('toast.logoutSuccess'), 2500, 'info');
    }

    // ── Check existing session ───────────────────────────────
    async function checkSession() {
        try {
            var data = await api('GET', '/admin/me');
            adminUser = data.admin;
            showDashboard();
            return true;
        } catch (_) {
            showLogin();
            return false;
        }
    }

    // ── Load data ────────────────────────────────────────────
    async function loadAllData() {
        renderSkeletonRows(usersTbody, 7, 4);
        renderSkeletonRows(urlsTbody,  9, 4);
        await Promise.all([loadUsers(), loadUrls()]);
    }

    async function loadUsers() {
        try {
            usersData = await api('GET', '/admin/users');
            usersCount.textContent = usersData.length;
            // Drop selections that no longer exist
            var ids = new Set(usersData.map(function (u) { return Number(u.id); }));
            selectedUsers.forEach(function (id) { if (!ids.has(id)) selectedUsers.delete(id); });
            renderUsersTable(usersData);
            renderBulkBar();
        } catch (err) {
            if (err.message === 'Unauthorized') { showLogin(); return; }
            toast(err.message, 4000, 'error');
        }
    }

    async function loadUrls() {
        try {
            var qs = '?page=' + urlsPage + '&per_page=' + urlsPerPage;
            if (urlsCurrentSearch) qs += '&q=' + encodeURIComponent(urlsCurrentSearch);
            var resp = await api('GET', '/admin/urls' + qs);
            urlsData = resp.data || [];
            urlsTotal = resp.total || 0;
            urlsCount.textContent = urlsTotal;
            var ids = new Set(urlsData.map(function (u) { return Number(u.id); }));
            selectedUrls.forEach(function (id) { if (!ids.has(id)) selectedUrls.delete(id); });
            renderUrlsTable(urlsData);
            renderUrlsPagination();
            renderBulkBar();
        } catch (err) {
            if (err.message === 'Unauthorized') { showLogin(); return; }
            toast(err.message, 4000, 'error');
        }
    }

    function renderUrlsPagination() {
        if (!urlsPagination) return;
        var totalPages = Math.max(1, Math.ceil(urlsTotal / urlsPerPage));
        if (urlsTotal <= urlsPerPage) { urlsPagination.innerHTML = ''; return; }
        var prev = urlsPage > 1
            ? '<button class="btn-secondary btn-small" id="urls-page-prev">←</button>'
            : '<button class="btn-secondary btn-small" disabled>←</button>';
        var next = urlsPage < totalPages
            ? '<button class="btn-secondary btn-small" id="urls-page-next">→</button>'
            : '<button class="btn-secondary btn-small" disabled>→</button>';
        urlsPagination.innerHTML = prev +
            '<span class="page-info">' + urlsPage + ' / ' + totalPages + ' · ' + urlsTotal + '</span>' +
            next;
        var pp = $('#urls-page-prev'); if (pp) pp.addEventListener('click', function () { urlsPage--; loadUrls(); });
        var pn = $('#urls-page-next'); if (pn) pn.addEventListener('click', function () { urlsPage++; loadUrls(); });
    }

    // ── Render Users ─────────────────────────────────────────
    function renderUsersTable(users) {
        if (!users.length) {
            usersEmpty.classList.add('hidden');
            var filtered = usersSearch.value.trim() !== '';
            renderEmptyState(
                usersTbody.parentElement, // .admin-table-wrap
                EMPTY_USER_SVG,
                filtered ? t('empty.noUsersTitle') : t('admin.noUsers'),
                filtered ? t('empty.noUsersDesc') : ''
            );
            return;
        }
        usersEmpty.classList.add('hidden');

        // Make sure the table is back (might have been replaced by empty state)
        ensureUsersTableMounted();

        usersTbody.innerHTML = users.map(function (u) {
            var isActive = Number(u.is_active) === 1;
            var isAdmin = Number(u.is_admin) === 1;
            var isSelf = adminUser && Number(u.id) === Number(adminUser.id);
            var statusClass = isActive ? 'status-active' : 'status-blocked';
            var statusText = isActive ? t('admin.statusActive') : t('admin.statusBlocked');
            var toggleLabel = isActive ? t('admin.blockBtn') : t('admin.unblockBtn');
            var toggleIcon = isActive ? '🚫' : '✅';
            var adminBadge = isAdmin ? ' <span class="status-badge status-admin">Admin</span>' : '';
            var selfLabel = isSelf ? ' <span style="color:var(--text-secondary);font-size:0.75rem">(' + escapeHtml(t('admin.youLabel')) + ')</span>' : '';
            var linkCount = u.link_count !== undefined ? u.link_count : '—';
            var checked = selectedUsers.has(Number(u.id)) ? ' checked' : '';
            var rowClass = checked ? ' class="row-selected"' : '';
            var checkboxCell = isSelf
                ? '<td class="col-check"></td>'
                : '<td class="col-check"><input type="checkbox" class="row-check" data-kind="users" data-id="' + u.id + '"' + checked + '></td>';

            var actions = '<button class="btn-icon-sm" onclick="window.__editUserModal(' + u.id + ')" title="' + escapeHtml(t('admin.editBtn')) + '">✏️</button>';
            actions += '<button class="btn-icon-sm" onclick="window.__viewUserLinks(' + u.id + ', \'' + escapeHtml(u.email).replace(/'/g, "\\'") + '\')" title="' + escapeHtml(t('admin.viewLinksBtn')) + '">🔗</button>';
            if (!isSelf) {
                actions += '<button class="btn-icon-sm" onclick="window.__toggleUser(' + u.id + ', ' + (isActive ? 'false' : 'true') + ')" title="' + escapeHtml(toggleLabel) + '">' + toggleIcon + '</button>';
                actions += '<button class="btn-icon-sm danger" onclick="window.__deleteUser(' + u.id + ', \'' + escapeHtml(u.email).replace(/'/g, "\\'") + '\')" title="' + escapeHtml(t('admin.deleteBtn')) + '">🗑️</button>';
            }

            return '<tr' + rowClass + '>' +
                checkboxCell +
                '<td class="col-id" data-label="ID">' + u.id + '</td>' +
                '<td data-label="' + escapeHtml(t('admin.colEmail')) + '">' + escapeHtml(u.email) + adminBadge + selfLabel + '</td>' +
                '<td data-label="' + escapeHtml(t('admin.colStatus')) + '"><span class="status-badge ' + statusClass + '">' + escapeHtml(statusText) + '</span></td>' +
                '<td class="col-clicks" data-label="' + escapeHtml(t('admin.colLinks')) + '">' + linkCount + '</td>' +
                '<td class="col-date" data-label="' + escapeHtml(t('admin.colCreated')) + '">' + formatDate(u.created_at) + '</td>' +
                '<td class="col-actions">' + actions + '</td>' +
            '</tr>';
        }).join('');

        bindCheckboxes('users');
    }

    function ensureUsersTableMounted() {
        var wrap = document.querySelector('#panel-users .admin-table-wrap');
        if (!wrap || wrap.querySelector('#users-table')) return;
        wrap.innerHTML =
            '<table class="admin-table" id="users-table">' +
                '<thead><tr>' +
                    '<th class="col-check"><input type="checkbox" id="check-all-users"></th>' +
                    '<th class="col-id">ID</th>' +
                    '<th>' + escapeHtml(t('admin.colEmail')) + '</th>' +
                    '<th>' + escapeHtml(t('admin.colStatus')) + '</th>' +
                    '<th class="col-clicks">' + escapeHtml(t('admin.colLinks')) + '</th>' +
                    '<th class="col-date">' + escapeHtml(t('admin.colCreated')) + '</th>' +
                    '<th class="col-actions">' + escapeHtml(t('admin.colActions')) + '</th>' +
                '</tr></thead>' +
                '<tbody id="users-tbody"></tbody>' +
            '</table>';
        usersTbody = $('#users-tbody');
        bindCheckAll('users');
    }

    function ensureUrlsTableMounted() {
        var wrap = document.querySelector('#panel-urls .admin-table-wrap');
        if (!wrap || wrap.querySelector('#urls-table')) return;
        wrap.innerHTML =
            '<table class="admin-table" id="urls-table">' +
                '<thead><tr>' +
                    '<th class="col-check"><input type="checkbox" id="check-all-urls"></th>' +
                    '<th class="col-id">ID</th>' +
                    '<th class="col-url">' + escapeHtml(t('admin.colOriginalUrl')) + '</th>' +
                    '<th class="col-short">' + escapeHtml(t('admin.colShortUrl')) + '</th>' +
                    '<th class="col-owner">' + escapeHtml(t('admin.colOwner')) + '</th>' +
                    '<th class="col-clicks">' + escapeHtml(t('admin.colClicks')) + '</th>' +
                    '<th class="col-date">' + escapeHtml(t('admin.colExpires')) + '</th>' +
                    '<th class="col-date">' + escapeHtml(t('admin.colCreated')) + '</th>' +
                    '<th class="col-actions">' + escapeHtml(t('admin.colActions')) + '</th>' +
                '</tr></thead>' +
                '<tbody id="urls-tbody"></tbody>' +
            '</table>';
        urlsTbody = $('#urls-tbody');
        bindCheckAll('urls');
    }

    // ── Render URLs ──────────────────────────────────────────
    function renderUrlsTable(urls) {
        if (!urls.length) {
            urlsEmpty.classList.add('hidden');
            var filtered = urlsSearch.value.trim() !== '';
            renderEmptyState(
                document.querySelector('#panel-urls .admin-table-wrap'),
                EMPTY_LINK_SVG,
                filtered ? t('empty.noLinksFilteredTitle') : t('empty.noAdminLinksTitle'),
                filtered ? t('empty.noLinksFilteredDesc')  : t('empty.noAdminLinksDesc')
            );
            return;
        }
        urlsEmpty.classList.add('hidden');
        ensureUrlsTableMounted();

        urlsTbody.innerHTML = urls.map(function (u) {
            var exp = u.expires_at ? formatDateTime(u.expires_at) : '∞';
            var owner = u.owner_email ? escapeHtml(u.owner_email) : '—';
            var checked = selectedUrls.has(Number(u.id)) ? ' checked' : '';
            var rowClass = checked ? ' class="row-selected"' : '';

            return '<tr' + rowClass + '>' +
                '<td class="col-check"><input type="checkbox" class="row-check" data-kind="urls" data-id="' + u.id + '"' + checked + '></td>' +
                '<td class="col-id" data-label="ID">' + u.id + '</td>' +
                '<td class="col-url" data-label="' + escapeHtml(t('admin.colOriginalUrl')) + '">' +
                    '<a href="' + escapeHtml(u.original_url) + '" target="_blank" rel="noopener" title="' + escapeHtml(u.original_url) + '">' +
                        escapeHtml(u.original_url.length > 50 ? u.original_url.substring(0, 50) + '…' : u.original_url) +
                    '</a>' +
                '</td>' +
                '<td class="col-short" data-label="' + escapeHtml(t('admin.colShortUrl')) + '"><a href="' + escapeHtml(u.short_url) + '" target="_blank" rel="noopener" class="short-link" title="' + escapeHtml(u.short_url) + '">' + escapeHtml(u.short_code) + '</a></td>' +
                '<td class="col-owner" data-label="' + escapeHtml(t('admin.colOwner')) + '">' + escapeHtml(owner) + '</td>' +
                '<td class="col-clicks" data-label="' + escapeHtml(t('admin.colClicks')) + '">' + u.clicks + '</td>' +
                '<td class="col-date" data-label="' + escapeHtml(t('admin.colExpires')) + '">' + exp + '</td>' +
                '<td class="col-date" data-label="' + escapeHtml(t('admin.colCreated')) + '">' + formatDate(u.created_at) + '</td>' +
                '<td class="col-actions">' +
                    '<button class="btn-icon-sm" onclick="window.__editUrlModal(' + u.id + ')" title="' + escapeHtml(t('admin.editBtn')) + '">✏️</button>' +
                    '<button class="btn-icon-sm" onclick="window.__showAdminStats(' + u.id + ')" title="' + escapeHtml(t('admin.statsBtn')) + '">📊</button>' +
                    '<button class="btn-icon-sm" onclick="window.__copyAdminUrl(\'' + escapeHtml(u.short_url) + '\')" title="' + escapeHtml(t('myUrls.copyBtn')) + '">📋</button>' +
                    '<button class="btn-icon-sm danger" onclick="window.__deleteAdminUrl(' + u.id + ')" title="' + escapeHtml(t('admin.deleteBtn')) + '">🗑️</button>' +
                '</td>' +
            '</tr>';
        }).join('');

        bindCheckboxes('urls');
    }

    // ── Checkbox wiring ──────────────────────────────────────
    function bindCheckboxes(kind) {
        var set = kind === 'users' ? selectedUsers : selectedUrls;
        var tbody = kind === 'users' ? usersTbody : urlsTbody;
        tbody.querySelectorAll('.row-check[data-kind="' + kind + '"]').forEach(function (cb) {
            cb.addEventListener('change', function () {
                var id = Number(cb.getAttribute('data-id'));
                if (cb.checked) set.add(id); else set.delete(id);
                cb.closest('tr').classList.toggle('row-selected', cb.checked);
                renderBulkBar();
                syncCheckAll(kind);
            });
        });
        syncCheckAll(kind);
    }

    function bindCheckAll(kind) {
        var headerCheck = document.getElementById('check-all-' + kind);
        if (!headerCheck) return;
        headerCheck.addEventListener('change', function () {
            var rows = (kind === 'users' ? usersTbody : urlsTbody)
                .querySelectorAll('.row-check[data-kind="' + kind + '"]');
            var set = kind === 'users' ? selectedUsers : selectedUrls;
            rows.forEach(function (cb) {
                var id = Number(cb.getAttribute('data-id'));
                cb.checked = headerCheck.checked;
                if (cb.checked) set.add(id); else set.delete(id);
                cb.closest('tr').classList.toggle('row-selected', cb.checked);
            });
            renderBulkBar();
        });
    }

    function syncCheckAll(kind) {
        var headerCheck = document.getElementById('check-all-' + kind);
        if (!headerCheck) return;
        var rows = (kind === 'users' ? usersTbody : urlsTbody)
            .querySelectorAll('.row-check[data-kind="' + kind + '"]');
        if (!rows.length) { headerCheck.checked = false; headerCheck.indeterminate = false; return; }
        var checked = 0;
        rows.forEach(function (cb) { if (cb.checked) checked++; });
        headerCheck.checked = checked > 0 && checked === rows.length;
        headerCheck.indeterminate = checked > 0 && checked < rows.length;
    }

    // ── Bulk action bar ──────────────────────────────────────
    function renderBulkBar() {
        renderBulkBarFor('users', selectedUsers);
        renderBulkBarFor('urls',  selectedUrls);
    }

    function renderBulkBarFor(kind, set) {
        var panel = document.getElementById('panel-' + kind);
        if (!panel) return;
        var existing = panel.querySelector('.bulk-bar');
        if (!set.size) {
            if (existing) existing.remove();
            return;
        }
        var label = t('admin.bulkSelected').replace('{n}', set.size);
        var html =
            '<div class="bulk-bar">' +
                '<span class="bulk-bar-info">' + escapeHtml(label) + '</span>' +
                '<div class="bulk-bar-actions">' +
                    (kind === 'users'
                        ? '<button class="btn-secondary btn-small" data-bulk-act="activate">' + escapeHtml(t('admin.bulkActivate')) + '</button>' +
                          '<button class="btn-secondary btn-small" data-bulk-act="block">' + escapeHtml(t('admin.bulkBlock')) + '</button>'
                        : '') +
                    '<button class="btn-danger btn-small" data-bulk-act="delete">' + escapeHtml(t('admin.bulkDelete')) + '</button>' +
                    '<button class="btn-secondary btn-small" data-bulk-act="clear">' + escapeHtml(t('admin.bulkClear')) + '</button>' +
                '</div>' +
            '</div>';

        if (existing) {
            existing.outerHTML = html;
        } else {
            var header = panel.querySelector('.admin-panel-header');
            header.insertAdjacentHTML('afterend', html);
        }
        bindBulkBar(kind, set);
    }

    function bindBulkBar(kind, set) {
        var panel = document.getElementById('panel-' + kind);
        var bar = panel.querySelector('.bulk-bar');
        if (!bar) return;
        bar.querySelectorAll('[data-bulk-act]').forEach(function (btn) {
            btn.addEventListener('click', function () {
                var act = btn.getAttribute('data-bulk-act');
                handleBulkAction(kind, act, Array.from(set));
            });
        });
    }

    async function handleBulkAction(kind, action, ids) {
        if (action === 'clear') { clearSelection(kind); return; }
        var n = ids.length;
        var titleKey, descKey, danger = true;
        if (kind === 'users') {
            if (action === 'delete')   { titleKey = 'admin.bulkDeleteUsersTitle';   descKey = 'admin.bulkDeleteUsersDesc'; }
            if (action === 'block')    { titleKey = 'admin.bulkBlockUsersTitle';    descKey = 'admin.bulkBlockUsersDesc';  danger = false; }
            if (action === 'activate') { titleKey = 'admin.bulkActivateUsersTitle'; descKey = 'admin.bulkActivateUsersDesc'; danger = false; }
        } else {
            if (action === 'delete')   { titleKey = 'admin.bulkDeleteUrlsTitle';    descKey = 'admin.bulkDeleteUrlsDesc'; }
        }
        var ok = await confirmDialog({
            title: t(titleKey).replace('{n}', n),
            message: t(descKey),
            danger: danger,
            confirmText: action === 'delete' ? t('common.delete') : t('common.confirm')
        });
        if (!ok) return;

        var ok_count = 0, fail = 0;
        for (var i = 0; i < ids.length; i++) {
            try {
                if (kind === 'users') {
                    if (action === 'delete')   await api('DELETE', '/admin/users/' + ids[i]);
                    if (action === 'block')    await api('PUT',    '/admin/users/' + ids[i], { is_active: false });
                    if (action === 'activate') await api('PUT',    '/admin/users/' + ids[i], { is_active: true });
                } else {
                    if (action === 'delete')   await api('DELETE', '/admin/urls/' + ids[i]);
                }
                ok_count++;
            } catch (_) { fail++; }
        }
        clearSelection(kind);
        if (kind === 'users') await loadUsers(); else await loadUrls();
        if (fail === 0) toast(t('admin.bulkActionDone').replace('{n}', ok_count), 2500, 'success');
        else toast(t('admin.bulkActionPartial').replace('{ok}', ok_count).replace('{fail}', fail), 4000, 'error');
    }

    // ── Admin Actions (global) ───────────────────────────────
    window.__toggleUser = async function (id, activate) {
        try {
            await api('PUT', '/admin/users/' + id, { is_active: activate });
            toast(activate ? t('admin.userActivated') : t('admin.userBlocked'), 2500, 'success');
            loadUsers();
        } catch (err) {
            toast(err.message, 4000, 'error');
        }
    };

    window.__deleteUser = async function (id, email) {
        var ok = await confirmDialog({
            title: t('common.areYouSure'),
            message: t('admin.confirmDeleteUser').replace('{email}', email),
            confirmText: t('common.delete')
        });
        if (!ok) return;
        try {
            await api('DELETE', '/admin/users/' + id);
            toast(t('toast.deleted'), 2500, 'success');
            loadUsers();
        } catch (err) {
            toast(err.message, 4000, 'error');
        }
    };

    window.__deleteAdminUrl = async function (id) {
        var ok = await confirmDialog({
            title: t('common.areYouSure'),
            message: t('admin.confirmDeleteUrl'),
            confirmText: t('common.delete')
        });
        if (!ok) return;
        try {
            await api('DELETE', '/admin/urls/' + id);
            toast(t('toast.deleted'), 2500, 'success');
            loadUrls();
        } catch (err) {
            toast(err.message, 4000, 'error');
        }
    };

    window.__copyAdminUrl = function (url) {
        navigator.clipboard.writeText(url).then(function () { toast(t('toast.copied'), 2500, 'success'); });
    };

    window.__viewUserLinks = function (userId, email) {
        // Switch to URLs tab
        $$('.admin-tab').forEach(function (t) { t.classList.remove('active'); });
        document.querySelector('.admin-tab[data-panel="urls"]').classList.add('active');
        $$('.admin-panel').forEach(function (p) { p.classList.add('hidden'); });
        $('#panel-urls').classList.remove('hidden');
        // Filter by owner email
        urlsSearch.value = email;
        urlsSearch.dispatchEvent(new Event('input'));
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

    // ── User Modal ─────────────────────────────────────────────
    var userModal     = $('#user-modal');
    var userModalForm = $('#user-modal-form');
    var userModalId   = $('#user-modal-id');
    var userModalEmail    = $('#user-modal-email');
    var userModalPassword = $('#user-modal-password');
    var userModalAdmin    = $('#user-modal-admin');
    var userModalTitle    = $('#user-modal-title');
    var userModalSubmit   = $('#user-modal-submit');
    var userModalPwHint   = $('#user-modal-pw-hint');
    var userModalError    = $('#user-modal-error');

    $('#btn-create-user').addEventListener('click', function () {
        userModalId.value = '';
        userModalEmail.value = '';
        userModalPassword.value = '';
        userModalAdmin.checked = false;
        userModalTitle.textContent = t('admin.createUserTitle');
        userModalSubmit.textContent = t('admin.createUserBtn');
        userModalPwHint.classList.add('hidden');
        userModalPassword.required = true;
        userModalError.classList.add('hidden');
        userModal.classList.remove('hidden');
    });

    window.__editUserModal = function (id) {
        var user = usersData.find(function (u) { return Number(u.id) === id; });
        if (!user) return;
        userModalId.value = user.id;
        userModalEmail.value = user.email;
        userModalPassword.value = '';
        userModalAdmin.checked = Number(user.is_admin) === 1;
        userModalTitle.textContent = t('admin.editUserTitle');
        userModalSubmit.textContent = t('admin.saveBtn');
        userModalPwHint.classList.remove('hidden');
        userModalPassword.required = false;
        userModalError.classList.add('hidden');
        userModal.classList.remove('hidden');
    };

    function closeUserModal() {
        userModal.classList.add('hidden');
        userModalForm.reset();
        userModalError.classList.add('hidden');
    }

    $$('[data-close-user-modal]').forEach(function (el) {
        el.addEventListener('click', closeUserModal);
    });

    userModalForm.addEventListener('submit', async function (e) {
        e.preventDefault();
        userModalError.classList.add('hidden');
        var id = userModalId.value;
        var email = userModalEmail.value.trim();
        var password = userModalPassword.value;
        var isAdmin = userModalAdmin.checked;

        try {
            if (id) {
                // Edit
                var body = { email: email, is_admin: isAdmin };
                if (password) body.password = password;
                await api('PUT', '/admin/users/' + id, body);
                toast(t('admin.userUpdated'), 2500, 'success');
            } else {
                // Create
                await api('POST', '/admin/users', { email: email, password: password, is_admin: isAdmin });
                toast(t('admin.userCreated'), 2500, 'success');
            }
            closeUserModal();
            loadUsers();
        } catch (err) {
            userModalError.textContent = err.message;
            userModalError.classList.remove('hidden');
        }
    });

    // ── URL Modal ────────────────────────────────────────────
    var urlModal     = $('#url-modal');
    var urlModalForm = $('#url-modal-form');
    var urlModalId   = $('#url-modal-id');
    var urlModalUrl      = $('#url-modal-url');
    var urlModalAlias    = $('#url-modal-alias');
    var urlModalExpires  = $('#url-modal-expires');
    var urlModalTitle    = $('#url-modal-title');
    var urlModalSubmit   = $('#url-modal-submit');
    var urlModalError    = $('#url-modal-error');
    var urlModalOwner    = $('#url-modal-owner');

    function populateOwnerSelect(selectedId) {
        if (!urlModalOwner) return;
        var opts = ['<option value="">— ' + escapeHtml(t('admin.noOwner')) + ' —</option>'];
        usersData.forEach(function (u) {
            var sel = Number(u.id) === Number(selectedId) ? ' selected' : '';
            opts.push('<option value="' + u.id + '"' + sel + '>' + escapeHtml(u.email) + '</option>');
        });
        urlModalOwner.innerHTML = opts.join('');
    }

    $('#btn-create-url').addEventListener('click', function () {
        urlModalId.value = '';
        urlModalUrl.value = '';
        urlModalAlias.value = '';
        urlModalExpires.value = '';
        urlModalAlias.disabled = false;
        populateOwnerSelect(null);
        urlModalTitle.textContent = t('admin.createUrlTitle');
        urlModalSubmit.textContent = t('admin.createUrlBtn');
        urlModalError.classList.add('hidden');
        urlModal.classList.remove('hidden');
    });

    window.__editUrlModal = function (id) {
        var url = urlsData.find(function (u) { return Number(u.id) === id; });
        if (!url) return;
        urlModalId.value = url.id;
        urlModalUrl.value = url.original_url;
        urlModalAlias.value = url.short_code;
        urlModalAlias.disabled = false;
        urlModalExpires.value = serverUtcToLocalInput(url.expires_at);
        populateOwnerSelect(url.user_id);
        urlModalTitle.textContent = t('admin.editUrlTitle');
        urlModalSubmit.textContent = t('admin.saveBtn');
        urlModalError.classList.add('hidden');
        urlModal.classList.remove('hidden');
    };

    function closeUrlModal() {
        urlModal.classList.add('hidden');
        urlModalForm.reset();
        urlModalError.classList.add('hidden');
    }

    $$('[data-close-url-modal]').forEach(function (el) {
        el.addEventListener('click', closeUrlModal);
    });

    urlModalForm.addEventListener('submit', async function (e) {
        e.preventDefault();
        urlModalError.classList.add('hidden');
        var id = urlModalId.value;
        var url = urlModalUrl.value.trim();
        var alias = urlModalAlias.value.trim();
        var expires = urlModalExpires.value;
        var ownerRaw = urlModalOwner ? urlModalOwner.value : '';
        var expiresIso = expires ? new Date(expires).toISOString() : null;

        try {
            if (id) {
                // Edit
                var body = { url: url };
                if (alias) body.alias = alias;
                body.expires_at = expiresIso;
                body.user_id = ownerRaw === '' ? null : Number(ownerRaw);
                await api('PUT', '/admin/urls/' + id, body);
                toast(t('admin.urlUpdated'), 2500, 'success');
            } else {
                // Create
                var cbody = { url: url };
                if (alias) cbody.alias = alias;
                if (expiresIso) cbody.expires_at = expiresIso;
                if (ownerRaw !== '') cbody.user_id = Number(ownerRaw);
                await api('POST', '/admin/urls', cbody);
                toast(t('admin.urlCreated'), 2500, 'success');
            }
            closeUrlModal();
            loadUrls();
        } catch (err) {
            urlModalError.textContent = err.message;
            urlModalError.classList.remove('hidden');
        }
    });

    // ── Stats Modal ──────────────────────────────────────────
    var statsModal = $('#stats-modal');

    window.__showAdminStats = async function (id) {
        try {
            var data = await api('GET', '/admin/urls/' + id + '/stats');
            renderAdminStats(data);
            statsModal.classList.remove('hidden');
        } catch (err) {
            toast(err.message, 4000, 'error');
        }
    };

    $$('[data-close-stats]').forEach(function (el) {
        el.addEventListener('click', function () { statsModal.classList.add('hidden'); });
    });

    function renderAdminStats(data) {
        $('#stats-total-count').textContent = data.total_clicks;

        // Bar chart
        var chart = $('#stats-chart');
        if (!data.clicks_by_day || !data.clicks_by_day.length) {
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
        if (!data.top_referers || !data.top_referers.length) {
            refList.innerHTML = '<li style="color:var(--text-secondary)">' + escapeHtml(t('myLinks.noData')) + '</li>';
        } else {
            refList.innerHTML = data.top_referers.map(function (r) {
                return '<li><span class="ref-name">' + escapeHtml(r.referer) + '</span><span class="ref-count">' + r.count + '</span></li>';
            }).join('');
        }
    }

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
        clearTimeout(urlsSearchDebounce);
        urlsSearchDebounce = setTimeout(function () {
            urlsCurrentSearch = urlsSearch.value.trim();
            urlsPage = 1;
            loadUrls();
        }, 250);
    });

    // ── Check-all checkboxes (initial wiring) ────────────────
    document.addEventListener('DOMContentLoaded', function () {
        bindCheckAll('users');
        bindCheckAll('urls');
    });
    // Also bind immediately for safety (script is at end of body)
    bindCheckAll('users');
    bindCheckAll('urls');

    // ── Export dropdowns ─────────────────────────────────────
    document.querySelectorAll('.export-wrap').forEach(function (wrap) {
        var toggle = wrap.querySelector('[data-export-toggle]');
        var menu   = wrap.querySelector('.export-menu');
        toggle.addEventListener('click', function (e) {
            e.stopPropagation();
            document.querySelectorAll('.export-menu').forEach(function (m) {
                if (m !== menu) m.classList.add('hidden');
            });
            menu.classList.toggle('hidden');
        });
        wrap.querySelectorAll('.export-option').forEach(function (opt) {
            opt.addEventListener('click', function () {
                menu.classList.add('hidden');
                runExport(wrap.getAttribute('data-export-kind'), opt.getAttribute('data-export'));
            });
        });
    });
    document.addEventListener('click', function () {
        document.querySelectorAll('.export-menu').forEach(function (m) { m.classList.add('hidden'); });
    });

    async function runExport(kind, fmt) {
        toast(t('toast.exporting'), 2000, 'info');
        var rows = [];
        try {
            if (kind === 'users') {
                rows = (await api('GET', '/admin/users')).map(function (u) {
                    return {
                        id: u.id, email: u.email,
                        is_admin: Number(u.is_admin) === 1,
                        is_active: Number(u.is_active) === 1,
                        link_count: u.link_count != null ? u.link_count : 0,
                        created_at: u.created_at
                    };
                });
            } else {
                // Fetch all pages (max 200 per page on the backend)
                var page = 1, perPage = 200, all = [];
                while (true) {
                    var qs = '?page=' + page + '&per_page=' + perPage;
                    if (urlsCurrentSearch) qs += '&q=' + encodeURIComponent(urlsCurrentSearch);
                    var resp = await api('GET', '/admin/urls' + qs);
                    var data = resp.data || [];
                    all = all.concat(data);
                    if (all.length >= (resp.total || 0) || data.length < perPage) break;
                    page++;
                    if (page > 100) break; // safety stop
                }
                rows = all.map(function (u) {
                    return {
                        id: u.id,
                        short_code: u.short_code,
                        short_url: u.short_url,
                        original_url: u.original_url,
                        owner_email: u.owner_email || '',
                        clicks: u.clicks,
                        expires_at: u.expires_at || '',
                        created_at: u.created_at
                    };
                });
            }
        } catch (err) {
            toast(err.message, 4000, 'error');
            return;
        }

        var base = 'openshortener-' + kind + '-' + timestamp();
        if (fmt === 'csv') downloadBlob(toCsv(rows), 'text/csv',           base + '.csv');
        else                downloadBlob(JSON.stringify(rows, null, 2), 'application/json', base + '.json');
        toast(t('toast.exportReady'), 2000, 'success');
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
    loadLanguage(detectLanguage()).then(function () {
        checkSession();
    });
})();
