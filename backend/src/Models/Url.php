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

    public static function update(int $id, array $fields): bool
    {
        $sets = [];
        $params = ['id' => $id];
        foreach ($fields as $col => $val) {
            $allowed = ['original_url', 'short_code', 'expires_at', 'is_active'];
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
}
