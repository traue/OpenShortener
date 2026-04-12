<?php

declare(strict_types=1);

namespace App\Services;

use App\Core\Database;

/**
 * Captcha throttling + Turnstile verification.
 *
 * Anonymous callers are throttled per IP; authenticated callers per user_id.
 * After N successful shortens within `window_hours`, a Turnstile token is
 * required for the next create.
 */
final class CaptchaService
{
    private static function cfg(): array
    {
        return (require __DIR__ . '/../../config/app.php')['captcha'];
    }

    private static function ensureTable(): void
    {
        Database::pdo()->exec(
            "CREATE TABLE IF NOT EXISTS url_creation_counts (
                scope      VARCHAR(10) NOT NULL,
                actor      VARCHAR(64) NOT NULL,
                hits       INT UNSIGNED NOT NULL DEFAULT 0,
                window_start DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (scope, actor)
            ) ENGINE=InnoDB"
        );
    }

    public static function isEnabled(): bool
    {
        $cfg = self::cfg();
        return $cfg['enabled'] && $cfg['site_key'] !== '' && $cfg['secret_key'] !== '';
    }

    public static function siteKey(): string
    {
        return (string) self::cfg()['site_key'];
    }

    /**
     * Returns how many creates the actor has made in the current window.
     * Resets the counter if the window has elapsed.
     */
    public static function currentHits(string $scope, string $actor): int
    {
        self::ensureTable();
        $cfg = self::cfg();
        $pdo = Database::pdo();

        $stmt = $pdo->prepare(
            'SELECT hits, window_start FROM url_creation_counts WHERE scope = :s AND actor = :a'
        );
        $stmt->execute(['s' => $scope, 'a' => $actor]);
        $row = $stmt->fetch();
        if (!$row) {
            return 0;
        }

        $elapsed = time() - strtotime((string) $row['window_start']);
        if ($elapsed >= $cfg['window_hours'] * 3600) {
            // Window expired — reset
            $reset = $pdo->prepare(
                'UPDATE url_creation_counts SET hits = 0, window_start = UTC_TIMESTAMP() WHERE scope = :s AND actor = :a'
            );
            $reset->execute(['s' => $scope, 'a' => $actor]);
            return 0;
        }
        return (int) $row['hits'];
    }

    public static function thresholdFor(string $scope): int
    {
        $cfg = self::cfg();
        return $scope === 'user' ? (int) $cfg['user_threshold'] : (int) $cfg['anon_threshold'];
    }

    /** Increments the counter after a successful shorten. */
    public static function recordHit(string $scope, string $actor): void
    {
        self::ensureTable();
        $pdo = Database::pdo();
        $stmt = $pdo->prepare(
            'INSERT INTO url_creation_counts (scope, actor, hits, window_start)
             VALUES (:s, :a, 1, UTC_TIMESTAMP())
             ON DUPLICATE KEY UPDATE hits = hits + 1'
        );
        $stmt->execute(['s' => $scope, 'a' => $actor]);
    }

    /**
     * True when the actor has already passed the threshold and therefore
     * must send a valid Turnstile token with the next shorten request.
     */
    public static function isRequired(string $scope, string $actor): bool
    {
        if (!self::isEnabled()) {
            return false;
        }
        return self::currentHits($scope, $actor) >= self::thresholdFor($scope);
    }

    /**
     * Verifies a Turnstile token against Cloudflare's siteverify endpoint.
     * Returns true on success.
     */
    public static function verifyToken(string $token, ?string $remoteIp): bool
    {
        if (!self::isEnabled()) {
            return true;
        }
        if ($token === '') {
            return false;
        }
        $cfg = self::cfg();

        $payload = http_build_query([
            'secret'   => $cfg['secret_key'],
            'response' => $token,
            'remoteip' => $remoteIp ?? '',
        ]);

        $ctx = stream_context_create([
            'http' => [
                'method'        => 'POST',
                'header'        => "Content-Type: application/x-www-form-urlencoded\r\n",
                'content'       => $payload,
                'timeout'       => 5,
                'ignore_errors' => true,
            ],
        ]);

        $raw = @file_get_contents($cfg['verify_url'], false, $ctx);
        if ($raw === false) {
            return false;
        }
        $data = json_decode($raw, true);
        return is_array($data) && !empty($data['success']);
    }
}
