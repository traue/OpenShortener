<?php

declare(strict_types=1);

namespace App\Services;

use App\Models\Url;

final class UrlService
{
    private const RESERVED_ALIASES = [
        'api', 'admin', 'my-links', 'terms', 'qr',
        'assets', 'i18n', 'index', 'robots', 'sitemap',
        'favicon', 'login', 'register', 'logout',
    ];

    public static function shorten(string $originalUrl, ?string $alias, ?string $expiresAt, ?int $userId): array
    {
        $cfg = require __DIR__ . '/../../config/app.php';

        // Validate URL
        if (!filter_var($originalUrl, FILTER_VALIDATE_URL)) {
            throw new \InvalidArgumentException('Invalid URL');
        }

        // Determine short code
        if ($alias !== null && $alias !== '') {
            if (!preg_match('/^[a-zA-Z0-9_\-]+$/', $alias)) {
                throw new \InvalidArgumentException('Alias must contain only letters, numbers, hyphens and underscores');
            }
            if (in_array(strtolower($alias), self::RESERVED_ALIASES, true)) {
                throw new \InvalidArgumentException('This alias is a reserved word and cannot be used');
            }
            if (Url::codeExists($alias)) {
                throw new \InvalidArgumentException('Alias already in use');
            }
            $shortCode = $alias;
        } else {
            // Generate random short code with retry on collision
            $codeLen = max(3, (int) ($cfg['short_code_len'] ?? 5));
            $maxAttempts = 10;

            for ($attempt = 0; $attempt < $maxAttempts; $attempt++) {
                $shortCode = Base62Service::generateRandom($codeLen);
                try {
                    $id = Url::create($originalUrl, $shortCode, $userId, $expiresAt);
                    return [
                        'id'         => $id,
                        'short_code' => $shortCode,
                        'short_url'  => $cfg['base_url'] . '/' . $shortCode,
                        'original_url' => $originalUrl,
                        'expires_at' => $expiresAt,
                    ];
                } catch (\PDOException $e) {
                    // Duplicate key (SQLSTATE 23000) — retry with new code
                    if ($e->getCode() === '23000') {
                        // After several failures, increase code length
                        if ($attempt >= 5) {
                            $codeLen++;
                        }
                        continue;
                    }
                    throw $e;
                }
            }

            throw new \RuntimeException('Failed to generate unique short code');
        }

        // Alias path
        $id = Url::create($originalUrl, $shortCode, $userId, $expiresAt);

        return [
            'id'         => $id,
            'short_code' => $shortCode,
            'short_url'  => $cfg['base_url'] . '/' . $shortCode,
            'original_url' => $originalUrl,
            'expires_at' => $expiresAt,
        ];
    }

    public static function resolve(string $code): ?array
    {
        $url = Url::findByCode($code);
        if (!$url) {
            return null;
        }

        // Check expiration
        if ($url['expires_at'] !== null && strtotime($url['expires_at']) < time()) {
            return null;
        }

        Url::incrementClicks((int) $url['id']);

        return $url;
    }
}
