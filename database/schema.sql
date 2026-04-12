CREATE DATABASE IF NOT EXISTS openshortener
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

USE openshortener;

CREATE TABLE users (
    id         BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    email      VARCHAR(255)  NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    is_active  TINYINT(1)    NOT NULL DEFAULT 1,
    is_admin   TINYINT(1)    NOT NULL DEFAULT 0,
    created_at DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE urls (
    id           BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    original_url TEXT            NOT NULL,
    short_code   VARCHAR(20)     NOT NULL UNIQUE,
    user_id      BIGINT UNSIGNED NULL,
    expires_at   DATETIME        NULL,
    clicks       BIGINT UNSIGNED NOT NULL DEFAULT 0,
    is_active    TINYINT(1)      NOT NULL DEFAULT 1,
    created_at   DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_urls_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE INDEX idx_urls_short_code ON urls(short_code);
CREATE INDEX idx_urls_user_id    ON urls(user_id);

-- Click analytics table
CREATE TABLE click_logs (
    id          BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    url_id      BIGINT UNSIGNED NOT NULL,
    clicked_at  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ip_address  VARCHAR(45)     NULL,
    referer     TEXT            NULL,
    user_agent  TEXT            NULL,
    CONSTRAINT fk_clicks_url FOREIGN KEY (url_id) REFERENCES urls(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE INDEX idx_click_logs_url_id    ON click_logs(url_id);
CREATE INDEX idx_click_logs_clicked   ON click_logs(url_id, clicked_at);

-- Rate limiting table
CREATE TABLE rate_limits (
    ip_address VARCHAR(45) NOT NULL,
    endpoint   VARCHAR(100) NOT NULL,
    hits       INT UNSIGNED NOT NULL DEFAULT 1,
    window_start DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (ip_address, endpoint)
) ENGINE=InnoDB;

-- URL creation counters for captcha throttling.
-- scope = 'ip' for anonymous callers, 'user' for logged-in callers.
CREATE TABLE url_creation_counts (
    scope      VARCHAR(10) NOT NULL,
    actor      VARCHAR(64) NOT NULL,
    hits       INT UNSIGNED NOT NULL DEFAULT 0,
    window_start DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (scope, actor)
) ENGINE=InnoDB;

-- Seed default admin (password: admin123 - CHANGE IN PRODUCTION)
-- Default admin (email: admin@admin.com / password: admin123)
INSERT INTO users (email, password_hash, is_admin) VALUES (
    'admin@admin.com',
    '$argon2id$v=19$m=65536,t=4,p=1$WVJDU1FEZUFqU1B4VmFzZw$LfaWSCkGxo7Qdg7oiE2K+Y+OmaiR1helB5kXOvSvPdM',
    1
);
