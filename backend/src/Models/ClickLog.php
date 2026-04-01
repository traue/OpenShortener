<?php

declare(strict_types=1);

namespace App\Models;

use App\Core\Database;

final class ClickLog
{
    public static function create(int $urlId, ?string $ip, ?string $referer, ?string $userAgent): void
    {
        $stmt = Database::pdo()->prepare(
            'INSERT INTO click_logs (url_id, ip_address, referer, user_agent) VALUES (:uid, :ip, :ref, :ua)'
        );
        $stmt->execute([
            'uid' => $urlId,
            'ip'  => $ip,
            'ref' => $referer,
            'ua'  => $userAgent ? mb_substr($userAgent, 0, 512) : null,
        ]);
    }

    public static function countByUrl(int $urlId): int
    {
        $stmt = Database::pdo()->prepare('SELECT COUNT(*) FROM click_logs WHERE url_id = :uid');
        $stmt->execute(['uid' => $urlId]);
        return (int) $stmt->fetchColumn();
    }

    public static function clicksByDay(int $urlId, int $days = 30): array
    {
        $stmt = Database::pdo()->prepare(
            'SELECT DATE(clicked_at) AS day, COUNT(*) AS count
             FROM click_logs
             WHERE url_id = :uid AND clicked_at >= DATE_SUB(CURDATE(), INTERVAL :days DAY)
             GROUP BY DATE(clicked_at)
             ORDER BY day ASC'
        );
        $stmt->execute(['uid' => $urlId, 'days' => $days]);
        return $stmt->fetchAll();
    }

    public static function topReferers(int $urlId, int $limit = 10): array
    {
        $stmt = Database::pdo()->prepare(
            'SELECT COALESCE(referer, \'(direct)\') AS referer, COUNT(*) AS count
             FROM click_logs
             WHERE url_id = :uid
             GROUP BY referer
             ORDER BY count DESC
             LIMIT :lim'
        );
        $stmt->bindValue('uid', $urlId, \PDO::PARAM_INT);
        $stmt->bindValue('lim', $limit, \PDO::PARAM_INT);
        $stmt->execute();
        return $stmt->fetchAll();
    }

    public static function recentClicks(int $urlId, int $limit = 50): array
    {
        $stmt = Database::pdo()->prepare(
            'SELECT id, clicked_at, ip_address, referer, user_agent
             FROM click_logs
             WHERE url_id = :uid
             ORDER BY clicked_at DESC
             LIMIT :lim'
        );
        $stmt->bindValue('uid', $urlId, \PDO::PARAM_INT);
        $stmt->bindValue('lim', $limit, \PDO::PARAM_INT);
        $stmt->execute();
        return $stmt->fetchAll();
    }
}
