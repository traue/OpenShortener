<?php

declare(strict_types=1);

namespace App\Models;

use App\Core\Database;

final class Admin
{
    public static function findByUsername(string $username): ?array
    {
        $stmt = Database::pdo()->prepare('SELECT * FROM admins WHERE username = :username LIMIT 1');
        $stmt->execute(['username' => $username]);
        $row = $stmt->fetch();
        return $row ?: null;
    }
}
