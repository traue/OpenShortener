# OpenShortener

Open-source URL shortener with QR code generation, click analytics, user system, and admin panel.

## Features

- URL shortening with random Base62 codes
- Custom aliases and optional expiration
- Automatic QR code generation (PNG)
- Per-link click analytics: total clicks, daily breakdown (last 30 days), top referers
- User system (sign up, sign in, link management, password change)
- "My Links" page with fast server-side search, paginated list, configurable
  page size (10/25/50/100), and inline editing of both destination URL and alias
- Protected admin panel (unified user system with `is_admin` flag)
  - Full user and link management, search across owners/URLs/aliases
  - Bulk actions: block / activate / delete multiple at once
  - Export users and links to CSV or JSON
  - Tables collapse to stacked cards on mobile
- Admin shortcut shown in the header for signed-in admin users
- Captcha throttling (Cloudflare Turnstile) — only triggers after N
  shortens per IP/user, so the regular flow stays friction-free
- Internationalization (EN, PT-BR, ES) — extensible
- Dark / Light mode with a modern zinc + indigo palette
- Mobile-friendly (responsive cards, action bars, full-width controls)
- Installable PWA with offline fallback (service worker + manifest)
- Full REST API
- Rate limiting by IP

## Stack

| Layer    | Technology                            |
|----------|---------------------------------------|
| Backend  | PHP 8+ pure (no frameworks)           |
| Database | MariaDB 11                            |
| Frontend | HTML + CSS + JS (vanilla), PWA-ready  |
| QR Code  | endroid/qr-code                       |
| Captcha  | Cloudflare Turnstile (optional)       |
| Infra    | Docker + Docker Compose               |

## Project Structure

```
openshortener/
├── backend/
│   ├── .env.example          # Environment variables template
│   ├── composer.json
│   ├── config/
│   │   └── app.php
│   ├── public/
│   │   ├── .htaccess
│   │   └── index.php         # Entry point
│   ├── routes/
│   │   └── api.php
│   └── src/
│       ├── Controllers/      # Auth, Url, Admin, Redirect
│       ├── Core/             # Database, Env, Router, Session, Request, Response
│       ├── Middleware/       # Auth, RateLimit
│       ├── Models/           # User, Url, ClickLog, Admin
│       └── Services/         # Auth, Url, QrCode, Base62, Captcha
├── frontend/
│   ├── index.html
│   ├── my-links.html         # "My Links" page (search, pagination, stats)
│   ├── admin.html
│   ├── expired.html          # 404 / expired link page
│   ├── terms.html
│   ├── styles.css
│   ├── app.js
│   ├── my-links.js
│   ├── admin.js
│   ├── sw.js                 # Service worker (PWA / offline)
│   ├── site.webmanifest
│   ├── sitemap.xml
│   ├── robots.txt
│   ├── assets/               # Favicons, app icons
│   └── i18n/
│       ├── en.json
│       ├── pt-BR.json
│       └── es.json
├── database/
│   └── schema.sql
├── docker/
│   ├── backend.Dockerfile
│   ├── frontend.Dockerfile
│   └── nginx.conf
├── docker-compose.yml
├── LICENSE
└── README.md
```

## Quick Start with Docker

### Prerequisites

- [Docker](https://docs.docker.com/get-docker/) and [Docker Compose](https://docs.docker.com/compose/install/)

### Start the project

```bash
git clone https://github.com/thiagotraue/openshortener.git
cd openshortener

# Start all services (database, backend, frontend)
docker compose up --build -d
```

Allow ~15 seconds for MariaDB to initialize. Services will be available at:

| Service  | URL                          |
|----------|------------------------------|
| Frontend | http://localhost:8080         |
| API      | http://localhost:8080/api/v1  |
| Backend  | http://localhost:8000         |
| MariaDB  | localhost:3306               |

### Stop

```bash
docker compose down
```

To also remove database data:

```bash
docker compose down -v
```

## Manual Setup (without Docker)

### 1. Database

Install MariaDB 11+ and run:

```bash
mysql -u root -p < database/schema.sql
```

This creates the `openshortener` database, all tables, and the default admin.

### 2. Backend

```bash
cd backend

# Copy and edit the environment file
cp .env.example .env
# Adjust DB_HOST, DB_USER, DB_PASS for your environment

# Install PHP dependencies
composer install

# Start PHP built-in server (development)
php -S localhost:8000 -t public
```

### 3. Frontend

Serve the `frontend/` folder with any HTTP server. Example with Python:

```bash
cd frontend
python3 -m http.server 8080
```

Or with PHP's built-in server:

```bash
php -S localhost:8080 -t frontend
```

> **Note:** In production, configure a reverse proxy (nginx/Apache) to route `/api/*` and `/{code}` to the PHP backend. The PWA service worker (`/sw.js`) must be served from the site root with the `Service-Worker-Allowed: /` scope.

## Configuration (.env)

### Required

| Variable         | Description                       | Default                             |
|------------------|-----------------------------------|--------------------------------------|
| `DB_HOST`        | MariaDB host                      | `127.0.0.1`                         |
| `DB_PORT`        | MariaDB port                      | `3306`                              |
| `DB_NAME`        | Database name                     | `openshortener`                      |
| `DB_USER`        | Database user                     | `root`                              |
| `DB_PASS`        | Database password                 | *(empty)*                           |
| `APP_BASE_URL`   | Base URL for short links          | `https://short.opensource.dev.br`   |
| `CORS_ORIGIN`    | Allowed CORS origin               | `*`                                 |
| `SESSION_SECURE` | Send session cookie only over HTTPS | `true`                            |

### Captcha (optional — Cloudflare Turnstile)

The captcha is **off by default**. When enabled, it only kicks in after a
configurable number of shortens by the same actor (per-IP for anonymous,
per-user for signed-in) within a time window, so the regular flow stays
friction-free.

| Variable                  | Description                                  | Default |
|---------------------------|----------------------------------------------|---------|
| `CAPTCHA_ENABLED`         | `1` to enable, `0` to disable                | `0`     |
| `TURNSTILE_SITE_KEY`      | Public site key (rendered in the browser)    | *(empty)* |
| `TURNSTILE_SECRET_KEY`    | Server-side secret key                       | *(empty)* |
| `CAPTCHA_ANON_THRESHOLD`  | Shortens per IP before the captcha kicks in  | `5`     |
| `CAPTCHA_USER_THRESHOLD`  | Shortens per user before the captcha kicks in| `10`    |
| `CAPTCHA_WINDOW_HOURS`    | Time window for the threshold counter        | `24`    |

Get the keys at <https://dash.cloudflare.com> → Turnstile → Add site.

## API

Base: `/api/v1`

### Auth (User)

| Method | Endpoint      | Description        |
|--------|---------------|--------------------|
| POST   | `/register`   | Sign up            |
| POST   | `/login`      | Sign in            |
| POST   | `/logout`     | Sign out           |
| GET    | `/me`         | Session check (returns `is_admin`) |
| PUT    | `/password`   | Change password    |

### URLs

| Method | Endpoint              | Auth     | Description                              |
|--------|-----------------------|----------|------------------------------------------|
| POST   | `/shorten`            | Optional | Shorten a URL (may require captcha token)|
| GET    | `/captcha-status`     | Optional | Whether the next shorten will need captcha |
| GET    | `/my-urls`            | Yes      | List own links (`?page=&per_page=&q=`)   |
| PUT    | `/urls/{id}`          | Yes      | Edit a link (url, alias, expires_at)     |
| DELETE | `/urls/{id}`          | Yes      | Delete a link                            |
| GET    | `/urls/{id}/stats`    | Yes      | Click stats (total, daily, top referers) |

### Public

| Method | Endpoint      | Description         |
|--------|---------------|---------------------|
| GET    | `/{code}`     | 302 redirect        |
| GET    | `/qr/{code}`  | QR Code (PNG image) |

### Admin

| Method | Endpoint                    | Description                              |
|--------|-----------------------------|------------------------------------------|
| POST   | `/admin/login`              | Admin sign in                            |
| GET    | `/admin/me`                 | Admin session check                      |
| GET    | `/admin/users`              | List all users                           |
| POST   | `/admin/users`              | Create user                              |
| PUT    | `/admin/users/{id}`         | Update user (email, password, is_admin, is_active) |
| DELETE | `/admin/users/{id}`         | Delete user                              |
| GET    | `/admin/users/{id}/urls`    | List a user's URLs                       |
| GET    | `/admin/urls`               | List all URLs (`?page=&per_page=&q=`)    |
| POST   | `/admin/urls`               | Create URL (optionally assign owner)     |
| PUT    | `/admin/urls/{id}`          | Update URL (url, alias, expires, owner)  |
| DELETE | `/admin/urls/{id}`          | Delete URL                               |
| GET    | `/admin/urls/{id}/stats`    | Click stats for any URL                  |

> Bulk operations in the admin UI fan out to the per-item endpoints
> client-side, so they don't need dedicated routes. CSV / JSON export is
> also generated client-side from `GET /admin/users` and a paginated
> sweep of `GET /admin/urls`.

## Default Admin

The `schema.sql` automatically creates an admin user:

| Field    | Value             |
|----------|-------------------|
| Email    | `admin@admin.com` |
| Password | `admin123`        |

Admin users have `is_admin = 1` in the `users` table. There is no separate admin table — admin is a flag on the unified user system.

> **IMPORTANT:** Change the admin password immediately in production.

Access the admin panel at `/admin`. Signed-in admin users also see a
shortcut button to it from the header on the home and "My Links" pages.

## Internationalization (i18n)

The system automatically detects the browser language. Users can manually switch via the flag button in the header.

### Available languages

- 🇺🇸 English (default)
- 🇧🇷 Português (Brasil)
- 🇪🇸 Español

### Adding a new language

1. Copy `frontend/i18n/en.json` to `frontend/i18n/{code}.json` (e.g. `fr.json`)
2. Translate all keys
3. Add the code to the `SUPPORTED_LANGS` array in `frontend/app.js`,
   `frontend/my-links.js`, and `frontend/admin.js`:

```js
const SUPPORTED_LANGS = ['en', 'pt-BR', 'es', 'fr'];
```

## PWA / Offline

The site ships with a service worker (`frontend/sw.js`) and a web app
manifest (`frontend/site.webmanifest`), so it can be installed as a
standalone app on mobile and desktop.

Caching strategy:

- **Network-first** for HTML, JS, CSS, JSON — anything coupled to a
  deploy. Stale copies of these would break the UI (old i18n + new JS
  showing raw keys), so the network is always tried first and cache is
  only used as an offline fallback.
- **Cache-first** for images, fonts and icons — these rarely change.
- **Pass-through** (network-only) for `/api/*`, `/qr/*` and short-code
  redirects.

When the page is opened offline, navigation requests fall back to a
cached copy of `/index.html`. A red banner is shown at the top while
offline; a "back online" toast confirms recovery.

To force a refresh of the service worker after a deploy, bump
`CACHE_VERSION` at the top of `sw.js`.

## Security

- Passwords hashed with `PASSWORD_ARGON2ID`
- SQL injection protection (PDO prepared statements, no string concat)
- XSS protection (`escapeHtml` on frontend, `htmlspecialchars` on backend)
- Sessions: `HTTPOnly`, `SameSite: Lax`, configurable `Secure` flag
- Session regeneration on login
- Rate limiting by IP/endpoint
- Captcha throttling (Cloudflare Turnstile) after N shortens per IP/user
- Unified admin system: `is_admin` flag verified from DB on every admin request (real-time revocation)
- Admin self-protection: cannot delete or block own account (also enforced for bulk actions in the UI)
- Admin panel at `/admin` (clean URL)

## License

This project uses a proprietary license that requires:
1. **Attribution** to the original author (Thiago Traue) in all derivatives
2. **Notification** to the author about public forks within 30 days

See the [LICENSE](LICENSE) file for full details.
