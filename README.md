# OpenShortener

Open-source URL shortener with QR code generation, user system, and admin panel.

## Features

- URL shortening with random Base62 codes
- Custom aliases and optional expiration
- Automatic QR code generation (PNG)
- User system (sign up, sign in, link management, password change)
- Protected admin panel (unified user system with `is_admin` flag)
- Admin: full user and link management, search by owner
- Internationalization (EN, PT-BR) — extensible
- Dark / Light mode
- Full REST API
- Rate limiting by IP

## Stack

| Layer    | Technology                   |
|----------|------------------------------|
| Backend  | PHP 8+ pure (no frameworks)  |
| Database | MariaDB 11                   |
| Frontend | HTML + CSS + JS (vanilla)    |
| QR Code  | endroid/qr-code              |
| Infra    | Docker + Docker Compose      |

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
│       ├── Controllers/
│       ├── Core/              # Database, Env, Router, Session, Request, Response
│       ├── Middleware/         # Auth, RateLimit
│       ├── Models/            # User, Url
│       └── Services/          # Auth, Url, QrCode, Base62
├── frontend/
│   ├── index.html
│   ├── admin.html
│   ├── termos.html
│   ├── styles.css
│   ├── app.js
│   ├── admin.js
│   └── i18n/
│       ├── en.json
│       └── pt-BR.json
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

> **Note:** In production, configure a reverse proxy (nginx/Apache) to route `/api/*` and `/{code}` to the PHP backend.

## Configuration (.env)

| Variable       | Description                       | Default                             |
|----------------|-----------------------------------|--------------------------------------|
| `DB_HOST`      | MariaDB host                      | `127.0.0.1`                         |
| `DB_PORT`      | MariaDB port                      | `3306`                              |
| `DB_NAME`      | Database name                     | `openshortener`                      |
| `DB_USER`      | Database user                     | `root`                              |
| `DB_PASS`      | Database password                 | *(empty)*                           |
| `APP_BASE_URL` | Base URL for short links          | `https://short.opensource.dev.br`   |
| `CORS_ORIGIN`  | Allowed CORS origin               | `*`                                 |

## API

Base: `/api/v1`

### Auth (User)

| Method | Endpoint      | Description        |
|--------|---------------|--------------------|
| POST   | `/register`   | Sign up            |
| POST   | `/login`      | Sign in            |
| POST   | `/logout`     | Sign out           || GET    | `/me`         | Session check      |
| PUT    | `/password`   | Change password    |
### URLs

| Method | Endpoint      | Auth     | Description         |
|--------|---------------|----------|---------------------|
| POST   | `/shorten`    | Optional | Shorten a URL       |
| GET    | `/my-urls`    | Yes      | List own links      |
| PUT    | `/urls/{id}`  | Yes      | Edit a link         |
| DELETE | `/urls/{id}`  | Yes      | Delete a link       |

### Public

| Method | Endpoint      | Description         |
|--------|---------------|---------------------|
| GET    | `/{code}`     | 302 redirect        |
| GET    | `/qr/{code}`  | QR Code (PNG image) |

### Admin

| Method | Endpoint             | Description              |
|--------|----------------------|--------------------------|
| POST   | `/admin/login`       | Admin sign in (email)    |
| GET    | `/admin/me`          | Admin session check      |
| GET    | `/admin/users`       | List all users           |
| DELETE | `/admin/users/{id}`  | Delete user              |
| PUT    | `/admin/users/{id}`  | Block/activate user      |
| GET    | `/admin/users/{id}/urls` | List user's URLs     |
| GET    | `/admin/urls`        | List all URLs            |
| DELETE | `/admin/urls/{id}`   | Delete URL               |

## Default Admin

The `schema.sql` automatically creates an admin user:

| Field    | Value             |
|----------|-------------------|
| Email    | `admin@admin.com` |
| Password | `admin123`        |

Admin users have `is_admin = 1` in the `users` table. There is no separate admin table — admin is a flag on the unified user system.

> **IMPORTANT:** Change the admin password immediately in production.

Access the admin panel at `/admin`.

## Internationalization (i18n)

The system automatically detects the browser language. Users can manually switch via the flag button in the header.

### Available languages

- 🇺🇸 English (default)
- 🇧🇷 Português (Brasil)

### Adding a new language

1. Copy `frontend/i18n/en.json` to `frontend/i18n/{code}.json` (e.g. `es.json`)
2. Translate all keys
3. Add the code to the `SUPPORTED_LANGS` array in `frontend/app.js`:

```js
const SUPPORTED_LANGS = ['en', 'pt-BR', 'es'];
```

## Security

- Passwords hashed with `PASSWORD_ARGON2ID`
- SQL injection protection (PDO prepared statements)
- XSS protection (`escapeHtml` on frontend, `htmlspecialchars` on backend)
- Sessions: `HTTPOnly`, `SameSite: Lax`, configurable `Secure` flag
- Session regeneration on login
- Rate limiting by IP/endpoint
- Unified admin system: `is_admin` flag verified from DB on every admin request (real-time revocation)
- Admin self-protection: cannot delete or block own account
- Admin panel at `/admin` (clean URL)

## License

This project uses a proprietary license that requires:
1. **Attribution** to the original author (Thiago Traue) in all derivatives
2. **Notification** to the author about public forks within 30 days

See the [LICENSE](LICENSE) file for full details.
