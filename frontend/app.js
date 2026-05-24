(function () {
    'use strict';

    // ── Config ───────────────────────────────────────────────
    const API = '/api/v1';
    const SUPPORTED_LANGS = ['en', 'pt-BR', 'es'];
    const DEFAULT_LANG = 'en';

    // ── State ────────────────────────────────────────────────
    let currentUser = null;
    let lang = {};     // current translation object
    let langCode = ''; // current language code

    // ── DOM refs ─────────────────────────────────────────────
    const $ = (sel) => document.querySelector(sel);
    const $$ = (sel) => document.querySelectorAll(sel);

    const langToggle   = $('#lang-toggle');
    const langIcon     = $('#lang-icon');
    const langMenu     = $('#lang-menu');
    const langDropdown = langToggle.closest('.lang-dropdown');
    const themeToggle  = $('#theme-toggle');
    const themeIcon    = $('#theme-icon');
    const authArea     = $('#auth-area');
    const authModal    = $('#auth-modal');
    const loginForm    = $('#login-form');
    const registerForm = $('#register-form');
    const loginError   = $('#login-error');
    const registerError = $('#register-error');
    const passwordModal = $('#password-modal');
    const passwordForm  = $('#password-form');
    const passwordError = $('#password-error');
    const shortenForm  = $('#shorten-form');
    const urlInput     = $('#url-input');
    const aliasInput   = $('#alias-input');
    const expiresInput = $('#expires-input');
    const resultDiv    = $('#result');
    const shortUrlA    = $('#short-url');
    const copyBtn      = $('#copy-btn');
    const qrImg        = $('#qr-img');
    const myUrlsLink   = $('#my-urls-link');
    const expiresToggle = $('#expires-toggle');
    const captchaWrap   = $('#captcha-wrap');
    const captchaWidget = $('#captcha-widget');

    // ── Captcha state ────────────────────────────────────────
    var captchaToken = '';
    var captchaWidgetId = null;
    var captchaSiteKey = '';
    var captchaRendered = false;

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
        renderAuthArea();
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

    // ── Expiration toggle ────────────────────────────────────
    expiresToggle.addEventListener('change', function () {
        if (expiresToggle.checked) {
            expiresInput.classList.remove('hidden');
        } else {
            expiresInput.classList.add('hidden');
            expiresInput.value = '';
        }
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
        if (body) {
            opts.body = JSON.stringify(body);
        }
        var res = await fetch(API + path, opts);
        var data = await res.json().catch(function () { return {}; });
        if (!res.ok) {
            throw new Error(data.error || t('toast.unknownError'));
        }
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

    // ── Auth UI ──────────────────────────────────────────────
    function renderAuthArea() {
        if (currentUser) {
            var adminLink = currentUser.is_admin
                ? '<a href="/admin" class="btn-secondary btn-small admin-link" title="' + escapeHtml(t('header.adminPanel')) + '"><span aria-hidden="true">🛡️</span><span class="admin-link-label">' + escapeHtml(t('header.adminPanel')) + '</span></a>'
                : '';
            authArea.innerHTML =
                '<span class="auth-email">' + escapeHtml(currentUser.email) + '</span>' +
                adminLink +
                '<button class="btn-secondary btn-small" id="change-pw-btn" title="' + escapeHtml(t('auth.changePasswordLink')) + '">🔒</button>' +
                '<button class="btn-secondary btn-small" id="logout-btn">' + escapeHtml(t('auth.logoutBtn')) + '</button>';
            $('#change-pw-btn').addEventListener('click', function () { passwordModal.classList.remove('hidden'); });
            $('#logout-btn').addEventListener('click', handleLogout);
            myUrlsLink.classList.remove('hidden');
        } else {
            authArea.innerHTML = '<button class="btn-secondary" id="login-btn">' + escapeHtml(t('auth.loginTab')) + '</button>';
            $('#login-btn').addEventListener('click', function () { authModal.classList.remove('hidden'); });
            myUrlsLink.classList.add('hidden');
        }
    }

    // ── Auth tabs ────────────────────────────────────────────
    $$('.auth-tab').forEach(function (tab) {
        tab.addEventListener('click', function () {
            $$('.auth-tab').forEach(function (t) { t.classList.remove('active'); });
            tab.classList.add('active');
            var target = tab.getAttribute('data-tab');
            if (target === 'login') {
                loginForm.classList.remove('hidden');
                registerForm.classList.add('hidden');
            } else {
                loginForm.classList.add('hidden');
                registerForm.classList.remove('hidden');
            }
        });
    });

    // Close modal
    $$('[data-close-modal]').forEach(function (el) {
        el.addEventListener('click', function () { authModal.classList.add('hidden'); });
    });
    $$('[data-close-password]').forEach(function (el) {
        el.addEventListener('click', function () { passwordModal.classList.add('hidden'); passwordForm.reset(); passwordError.classList.add('hidden'); });
    });

    // ── Login ────────────────────────────────────────────────
    loginForm.addEventListener('submit', async function (e) {
        e.preventDefault();
        loginError.classList.add('hidden');
        var email = loginForm.email.value.trim();
        var password = loginForm.password.value;
        try {
            var data = await api('POST', '/login', { email: email, password: password });
            currentUser = data.user;
            authModal.classList.add('hidden');
            loginForm.reset();
            renderAuthArea();
            toast(t('toast.loginSuccess'), 2500, 'success');
        } catch (err) {
            loginError.textContent = err.message;
            loginError.classList.remove('hidden');
        }
    });

    // ── Register ─────────────────────────────────────────────
    registerForm.addEventListener('submit', async function (e) {
        e.preventDefault();
        registerError.classList.add('hidden');
        var email = registerForm.email.value.trim();
        var password = registerForm.password.value;
        try {
            var data = await api('POST', '/register', { email: email, password: password });
            currentUser = data.user;
            authModal.classList.add('hidden');
            registerForm.reset();
            renderAuthArea();
            toast(t('toast.registerSuccess'), 2500, 'success');
        } catch (err) {
            registerError.textContent = err.message;
            registerError.classList.remove('hidden');
        }
    });

    // ── Change password ──────────────────────────────────────
    passwordForm.addEventListener('submit', async function (e) {
        e.preventDefault();
        passwordError.classList.add('hidden');
        var currentPw = passwordForm.current_password.value;
        var newPw = passwordForm.new_password.value;
        var confirmPw = passwordForm.confirm_password.value;
        if (newPw !== confirmPw) {
            passwordError.textContent = t('auth.passwordMismatch');
            passwordError.classList.remove('hidden');
            return;
        }
        try {
            await api('PUT', '/password', { current_password: currentPw, new_password: newPw });
            passwordModal.classList.add('hidden');
            passwordForm.reset();
            toast(t('toast.passwordChanged'), 2500, 'success');
        } catch (err) {
            passwordError.textContent = err.message;
            passwordError.classList.remove('hidden');
        }
    });

    // ── Logout ───────────────────────────────────────────────
    async function handleLogout() {
        try { await api('POST', '/logout'); } catch (_) { /* ignore */ }
        currentUser = null;
        renderAuthArea();
        toast(t('toast.logoutSuccess'), 2500, 'info');
    }

    // ── Captcha (Turnstile) ──────────────────────────────────
    function renderCaptcha(siteKey) {
        if (!siteKey) return;
        captchaSiteKey = siteKey;
        captchaWrap.classList.remove('hidden');
        if (captchaRendered || !window.turnstile) return;
        try {
            captchaWidgetId = window.turnstile.render(captchaWidget, {
                sitekey: siteKey,
                callback: function (token) { captchaToken = token; },
                'expired-callback': function () { captchaToken = ''; },
                'error-callback':   function () { captchaToken = ''; }
            });
            captchaRendered = true;
        } catch (_) { /* ignore */ }
    }

    function resetCaptcha() {
        captchaToken = '';
        if (captchaRendered && window.turnstile && captchaWidgetId !== null) {
            try { window.turnstile.reset(captchaWidgetId); } catch (_) {}
        }
    }

    async function checkCaptchaStatus() {
        try {
            var status = await api('GET', '/captcha-status');
            if (status.enabled && status.required && status.site_key) {
                if (window.turnstile) {
                    renderCaptcha(status.site_key);
                } else {
                    captchaSiteKey = status.site_key;
                    captchaWrap.classList.remove('hidden');
                    var tries = 0;
                    var iv = setInterval(function () {
                        if (window.turnstile) { clearInterval(iv); renderCaptcha(captchaSiteKey); }
                        else if (++tries > 50) { clearInterval(iv); }
                    }, 200);
                }
            }
        } catch (_) { /* ignore */ }
    }

    // ── Shorten ──────────────────────────────────────────────
    shortenForm.addEventListener('submit', async function (e) {
        e.preventDefault();
        var url = urlInput.value.trim();
        var alias = aliasInput.value.trim() || undefined;
        var expiresAt = expiresInput.value || undefined;

        if (!url) return;

        try {
            var payload = { url: url };
            if (alias) payload.alias = alias;
            if (expiresAt) payload.expires_at = new Date(expiresAt).toISOString();
            if (captchaToken) payload.captcha_token = captchaToken;

            var res = await fetch(API + '/shorten', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(payload),
            });
            var data = await res.json().catch(function () { return {}; });

            if (res.status === 428 && data.captcha_required) {
                renderCaptcha(data.site_key || captchaSiteKey);
                toast(t('toast.captchaRequired'), 4000, 'info');
                return;
            }
            if (!res.ok) {
                throw new Error(data.error || t('toast.unknownError'));
            }

            shortUrlA.href = data.short_url;
            shortUrlA.textContent = data.short_url;
            qrImg.src = 'data:image/png;base64,' + data.qr_code;
            resultDiv.classList.remove('hidden');
            resetCaptcha();
        } catch (err) {
            toast(err.message, 4000, 'error');
        }
    });

    // ── Copy ─────────────────────────────────────────────────
    copyBtn.addEventListener('click', function () {
        var text = shortUrlA.textContent;
        navigator.clipboard.writeText(text).then(function () { toast(t('toast.copied'), 2500, 'success'); });
    });

    // ── Escape HTML helper ───────────────────────────────────
    function escapeHtml(str) {
        var div = document.createElement('div');
        div.appendChild(document.createTextNode(str));
        return div.innerHTML;
    }

    function escapeAttr(str) {
        return str.replace(/&/g, '&amp;').replace(/'/g, '&#39;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    // ── Check existing session ─────────────────────────────────
    async function checkSession() {
        try {
            var data = await api('GET', '/me');
            currentUser = data.user;
        } catch (_) {
            currentUser = null;
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
    loadLanguage(detectLanguage()).then(function () {
        checkSession().then(function () {
            renderAuthArea();
            checkCaptchaStatus();
        });
    });
})();
