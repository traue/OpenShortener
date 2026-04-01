<?php

declare(strict_types=1);

namespace App\Services;

use App\Models\Url;

final class UrlService
{
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
            if (Url::codeExists($alias)) {
                throw new \InvalidArgumentException('Alias already in use');
            }
            $shortCode = $alias;
        } else {
            // Create entry with placeholder, then encode ID
            $id = Url::create($originalUrl, '__temp__', $userId, $expiresAt);
            $shortCode = Base62Service::encode($id);

            // Ensure uniqueness (very unlikely collision)
            $attempts = 0;
            while (Url::codeExists($shortCode)) {
                $shortCode = Base62Service::generateRandom($cfg['short_code_len']);
                if (++$attempts > 5) {
                    throw new \RuntimeException('Failed to generate unique code');
                }
            }

            Url::update($id, ['short_code' => $shortCode]);

            return [
                'id'         => $id,
                'short_code' => $shortCode,
                'short_url'  => $cfg['base_url'] . '/' . $shortCode,
                'original_url' => $originalUrl,
                'expires_at' => $expiresAt,
            ];
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
