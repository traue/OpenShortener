<?php

declare(strict_types=1);

namespace App\Middleware;

use App\Core\Database;
use App\Core\Request;
use App\Core\Response;

final class RateLimitMiddleware
{
    public static function check(): bool
    {
        $cfg = require __DIR__ . '/../../config/app.php';
        $ip       = Request::ip();
        $endpoint = $_SERVER['REQUEST_URI'] ?? '/';
        $window   = $cfg['rate_limit']['window'];
        $maxHits  = $cfg['rate_limit']['max_hits'];
        $pdo      = Database::pdo();

        $now = date('Y-m-d H:i:s');

        // Clean expired windows
        $stmt = $pdo->prepare(
            'DELETE FROM rate_limits WHERE window_start < DATE_SUB(:now, INTERVAL :window SECOND)'
        );
        $stmt->execute(['now' => $now, 'window' => $window]);

        // Check current hits
        $stmt = $pdo->prepare(
            'SELECT hits, window_start FROM rate_limits WHERE ip_address = :ip AND endpoint = :ep'
        );
        $stmt->execute(['ip' => $ip, 'ep' => $endpoint]);
        $row = $stmt->fetch();

        if (!$row) {
            $stmt = $pdo->prepare(
                'INSERT INTO rate_limits (ip_address, endpoint, hits, window_start) VALUES (:ip, :ep, 1, :now)'
            );
            $stmt->execute(['ip' => $ip, 'ep' => $endpoint, 'now' => $now]);
            return true;
        }

        if ($row['hits'] >= $maxHits) {
            Response::error('Too many requests', 429);
            return false;
        }

        $stmt = $pdo->prepare(
            'UPDATE rate_limits SET hits = hits + 1 WHERE ip_address = :ip AND endpoint = :ep'
        );
        $stmt->execute(['ip' => $ip, 'ep' => $endpoint]);

        return true;
    }
}
