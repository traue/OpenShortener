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
        toast(t('toast.logoutSuccess'));
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
            var qs = '?page=' + urlsPage + '&per_page=' + urlsPerPage;
            if (urlsCurrentSearch) qs += '&q=' + encodeURIComponent(urlsCurrentSearch);
            var resp = await api('GET', '/admin/urls' + qs);
            urlsData = resp.data || [];
            urlsTotal = resp.total || 0;
            urlsCount.textContent = urlsTotal;
            renderUrlsTable(urlsData);
            renderUrlsPagination();
        } catch (err) {
            if (err.message === 'Unauthorized') { showLogin(); return; }
            toast(err.message, 4000);
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
            usersEmpty.classList.remove('hidden');
            usersTbody.innerHTML = '';
            return;
        }
        usersEmpty.classList.add('hidden');

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

            var actions = '<button class="btn-icon-sm" onclick="window.__editUserModal(' + u.id + ')" title="' + escapeHtml(t('admin.editBtn')) + '">✏️</button>';
            actions += '<button class="btn-icon-sm" onclick="window.__viewUserLinks(' + u.id + ', \'' + escapeHtml(u.email).replace(/'/g, "\\'") + '\')" title="' + escapeHtml(t('admin.viewLinksBtn')) + '">🔗</button>';
            if (!isSelf) {
                actions += '<button class="btn-icon-sm" onclick="window.__toggleUser(' + u.id + ', ' + (isActive ? 'false' : 'true') + ')" title="' + escapeHtml(toggleLabel) + '">' + toggleIcon + '</button>';
                actions += '<button class="btn-icon-sm danger" onclick="window.__deleteUser(' + u.id + ', \'' + escapeHtml(u.email).replace(/'/g, "\\'") + '\')" title="' + escapeHtml(t('admin.deleteBtn')) + '">🗑️</button>';
            }

            return '<tr>' +
                '<td class="col-id" data-label="ID">' + u.id + '</td>' +
                '<td data-label="' + escapeHtml(t('admin.colEmail')) + '">' + escapeHtml(u.email) + adminBadge + selfLabel + '</td>' +
                '<td data-label="' + escapeHtml(t('admin.colStatus')) + '"><span class="status-badge ' + statusClass + '">' + escapeHtml(statusText) + '</span></td>' +
                '<td class="col-clicks" data-label="' + escapeHtml(t('admin.colLinks')) + '">' + linkCount + '</td>' +
                '<td class="col-date" data-label="' + escapeHtml(t('admin.colCreated')) + '">' + formatDate(u.created_at) + '</td>' +
                '<td class="col-actions">' + actions + '</td>' +
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
            var exp = u.expires_at ? formatDateTime(u.expires_at) : '∞';
            var owner = u.owner_email ? escapeHtml(u.owner_email) : '—';

            return '<tr>' +
                '<td class="col-id" data-label="ID">' + u.id + '</td>' +
                '<td class="col-url" data-label="' + escapeHtml(t('admin.colOriginalUrl')) + '">' +
                    '<a href="' + escapeHtml(u.original_url) + '" target="_blank" rel="noopener" title="' + escapeHtml(u.original_url) + '">' +
                        escapeHtml(u.original_url.length > 50 ? u.original_url.substring(0, 50) + '…' : u.original_url) +
                    '</a>' +
                '</td>' +
                '<td data-label="' + escapeHtml(t('admin.colShortUrl')) + '"><a href="' + escapeHtml(u.short_url) + '" target="_blank" rel="noopener" class="short-link">' + escapeHtml(u.short_url) + '</a></td>' +
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
                toast(t('admin.userUpdated'));
            } else {
                // Create
                await api('POST', '/admin/users', { email: email, password: password, is_admin: isAdmin });
                toast(t('admin.userCreated'));
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
                toast(t('admin.urlUpdated'));
            } else {
                // Create
                var cbody = { url: url };
                if (alias) cbody.alias = alias;
                if (expiresIso) cbody.expires_at = expiresIso;
                if (ownerRaw !== '') cbody.user_id = Number(ownerRaw);
                await api('POST', '/admin/urls', cbody);
                toast(t('admin.urlCreated'));
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
            toast(err.message, 4000);
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

    // ── Init ─────────────────────────────────────────────────
    initTheme();
    loadLanguage(detectLanguage()).then(function () {
        checkSession();
    });
})();
