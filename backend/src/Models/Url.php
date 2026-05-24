<?php

declare(strict_types=1);

namespace App\Models;

use App\Core\Database;

final class Url
{
    public static function create(string $originalUrl, string $shortCode, ?int $userId, ?string $expiresAt): int
    {
        $pdo = Database::pdo();
        $stmt = $pdo->prepare(
            'INSERT INTO urls (original_url, short_code, user_id, expires_at) VALUES (:url, :code, :uid, :exp)'
        );
        $stmt->execute([
            'url'  => $originalUrl,
            'code' => $shortCode,
            'uid'  => $userId,
            'exp'  => $expiresAt,
        ]);
        return (int) $pdo->lastInsertId();
    }

    public static function findByCode(string $code): ?array
    {
        $stmt = Database::pdo()->prepare('SELECT * FROM urls WHERE short_code = :code AND is_active = 1 LIMIT 1');
        $stmt->execute(['code' => $code]);
        $row = $stmt->fetch();
        return $row ?: null;
    }

    public static function findById(int $id): ?array
    {
        $stmt = Database::pdo()->prepare('SELECT * FROM urls WHERE id = :id LIMIT 1');
        $stmt->execute(['id' => $id]);
        $row = $stmt->fetch();
        return $row ?: null;
    }

    public static function codeExists(string $code): bool
    {
        $stmt = Database::pdo()->prepare('SELECT 1 FROM urls WHERE short_code = :code LIMIT 1');
        $stmt->execute(['code' => $code]);
        return (bool) $stmt->fetch();
    }

    public static function incrementClicks(int $id): void
    {
        $stmt = Database::pdo()->prepare('UPDATE urls SET clicks = clicks + 1 WHERE id = :id');
        $stmt->execute(['id' => $id]);
    }

    public static function findByUser(int $userId): array
    {
        $stmt = Database::pdo()->prepare(
            'SELECT id, original_url, short_code, expires_at, clicks, is_active, created_at FROM urls WHERE user_id = :uid ORDER BY created_at DESC'
        );
        $stmt->execute(['uid' => $userId]);
        return $stmt->fetchAll();
    }

    public static function findByUserPaged(int $userId, int $perPage, int $offset, ?string $search = null): array
    {
        $pdo = Database::pdo();
        $hasSearch = $search !== null && $search !== '';
        $where = 'WHERE user_id = :uid';
        $bind = ['uid' => $userId];
        if ($hasSearch) {
            // Two separate placeholders — PDO with emulate_prepares=false rejects re-used names.
            $where .= ' AND (original_url LIKE :q_url OR short_code LIKE :q_code)';
            $bind['q_url']  = '%' . $search . '%';
            $bind['q_code'] = '%' . $search . '%';
        }

        $total = (int) (function () use ($pdo, $where, $bind) {
            $stmt = $pdo->prepare("SELECT COUNT(*) AS c FROM urls {$where}");
            $stmt->execute($bind);
            return $stmt->fetch()['c'] ?? 0;
        })();

        $sql = "SELECT id, original_url, short_code, expires_at, clicks, is_active, created_at
                FROM urls {$where}
                ORDER BY created_at DESC
                LIMIT " . (int) $perPage . " OFFSET " . (int) $offset . "";
        $stmt = $pdo->prepare($sql);
        $stmt->execute($bind);
        return ['rows' => $stmt->fetchAll(), 'total' => $total];
    }

    public static function allWithOwnerPaged(int $perPage, int $offset, ?string $search = null): array
    {
        $pdo = Database::pdo();
        $hasSearch = $search !== null && $search !== '';
        $where = '';
        $bind = [];
        if ($hasSearch) {
            $where = 'WHERE u.original_url LIKE :q_url OR u.short_code LIKE :q_code OR usr.email LIKE :q_email';
            $bind['q_url']   = '%' . $search . '%';
            $bind['q_code']  = '%' . $search . '%';
            $bind['q_email'] = '%' . $search . '%';
        }

        $total = (int) (function () use ($pdo, $where, $bind) {
            $stmt = $pdo->prepare("SELECT COUNT(*) AS c FROM urls u LEFT JOIN users usr ON u.user_id = usr.id {$where}");
            $stmt->execute($bind);
            return $stmt->fetch()['c'] ?? 0;
        })();

        $sql = "SELECT u.id, u.original_url, u.short_code, u.user_id, u.expires_at, u.clicks, u.is_active, u.created_at, usr.email AS owner_email
                FROM urls u
                LEFT JOIN users usr ON u.user_id = usr.id
                {$where}
                ORDER BY u.created_at DESC
                LIMIT " . (int) $perPage . " OFFSET " . (int) $offset . "";
        $stmt = $pdo->prepare($sql);
        $stmt->execute($bind);
        return ['rows' => $stmt->fetchAll(), 'total' => $total];
    }

    public static function update(int $id, array $fields): bool
    {
        $sets = [];
        $params = ['id' => $id];
        $allowed = ['original_url', 'short_code', 'expires_at', 'is_active', 'user_id'];
        foreach ($fields as $col => $val) {
            if (!in_array($col, $allowed, true)) {
                continue;
            }
            $sets[] = "{$col} = :{$col}";
            $params[$col] = $val;
        }
        if (empty($sets)) {
            return false;
        }
        $sql = 'UPDATE urls SET ' . implode(', ', $sets) . ' WHERE id = :id';
        $stmt = Database::pdo()->prepare($sql);
        return $stmt->execute($params);
    }

    public static function delete(int $id): bool
    {
        $stmt = Database::pdo()->prepare('DELETE FROM urls WHERE id = :id');
        return $stmt->execute(['id' => $id]);
    }

    public static function all(): array
    {
        return Database::pdo()->query(
            'SELECT id, original_url, short_code, user_id, expires_at, clicks, is_active, created_at FROM urls ORDER BY created_at DESC'
        )->fetchAll();
    }

    public static function allWithOwner(): array
    {
        return Database::pdo()->query(
            'SELECT u.id, u.original_url, u.short_code, u.user_id, u.expires_at, u.clicks, u.is_active, u.created_at, usr.email AS owner_email FROM urls u LEFT JOIN users usr ON u.user_id = usr.id ORDER BY u.created_at DESC'
        )->fetchAll();
    }
}
