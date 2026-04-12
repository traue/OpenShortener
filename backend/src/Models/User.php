<?php

declare(strict_types=1);

namespace App\Models;

use App\Core\Database;

final class User
{
    public static function create(string $email, string $passwordHash): int
    {
        $pdo = Database::pdo();
        $stmt = $pdo->prepare('INSERT INTO users (email, password_hash) VALUES (:email, :hash)');
        $stmt->execute(['email' => $email, 'hash' => $passwordHash]);
        return (int) $pdo->lastInsertId();
    }

    public static function findByEmail(string $email): ?array
    {
        $stmt = Database::pdo()->prepare('SELECT * FROM users WHERE email = :email LIMIT 1');
        $stmt->execute(['email' => $email]);
        $row = $stmt->fetch();
        return $row ?: null;
    }

    public static function findById(int $id): ?array
    {
        $stmt = Database::pdo()->prepare('SELECT id, email, is_active, is_admin, created_at FROM users WHERE id = :id LIMIT 1');
        $stmt->execute(['id' => $id]);
        $row = $stmt->fetch();
        return $row ?: null;
    }

    public static function all(): array
    {
        return Database::pdo()->query(
            'SELECT u.id, u.email, u.is_active, u.is_admin, u.created_at,
                    (SELECT COUNT(*) FROM urls WHERE urls.user_id = u.id) AS link_count
             FROM users u
             ORDER BY u.created_at DESC'
        )->fetchAll();
    }

    /**
     * Soft delete: deactivates the user but keeps the row so their links
     * remain attached. Login/middleware checks is_active to block access.
     */
    public static function delete(int $id): bool
    {
        $stmt = Database::pdo()->prepare('UPDATE users SET is_active = 0 WHERE id = :id');
        return $stmt->execute(['id' => $id]);
    }

    public static function toggleActive(int $id, bool $active): bool
    {
        $stmt = Database::pdo()->prepare('UPDATE users SET is_active = :active WHERE id = :id');
        return $stmt->execute(['active' => $active ? 1 : 0, 'id' => $id]);
    }

    public static function findByIdFull(int $id): ?array
    {
        $stmt = Database::pdo()->prepare('SELECT * FROM users WHERE id = :id LIMIT 1');
        $stmt->execute(['id' => $id]);
        $row = $stmt->fetch();
        return $row ?: null;
    }

    public static function updatePassword(int $id, string $passwordHash): bool
    {
        $stmt = Database::pdo()->prepare('UPDATE users SET password_hash = :hash WHERE id = :id');
        return $stmt->execute(['hash' => $passwordHash, 'id' => $id]);
    }

    public static function updateUser(int $id, array $fields): bool
    {
        $sets = [];
        $params = ['id' => $id];
        $allowed = ['email', 'password_hash', 'is_active', 'is_admin'];
        foreach ($fields as $col => $val) {
            if (!in_array($col, $allowed, true)) continue;
            $sets[] = "{$col} = :{$col}";
            $params[$col] = $val;
        }
        if (empty($sets)) return false;
        $sql = 'UPDATE users SET ' . implode(', ', $sets) . ' WHERE id = :id';
        $stmt = Database::pdo()->prepare($sql);
        return $stmt->execute($params);
    }
}
