<?php

declare(strict_types=1);

namespace App\Services;

use App\Core\Session;
use App\Models\User;

final class AuthService
{
    public static function register(string $email, string $password): array
    {
        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            throw new \InvalidArgumentException('Invalid email');
        }

        if (strlen($password) < 8) {
            throw new \InvalidArgumentException('Password must be at least 8 characters');
        }

        if (User::findByEmail($email)) {
            throw new \InvalidArgumentException('Email already registered');
        }

        $hash = password_hash($password, PASSWORD_ARGON2ID);
        $id = User::create($email, $hash);

        Session::regenerate();
        Session::set('user_id', $id);

        return ['id' => $id, 'email' => $email];
    }

    public static function login(string $email, string $password): array
    {
        $user = User::findByEmail($email);

        if (!$user || !password_verify($password, $user['password_hash'])) {
            throw new \InvalidArgumentException('Invalid credentials');
        }

        if (!$user['is_active']) {
            throw new \InvalidArgumentException('Account is blocked');
        }

        Session::regenerate();
        Session::set('user_id', (int) $user['id']);

        return ['id' => (int) $user['id'], 'email' => $user['email']];
    }

    public static function adminLogin(string $username, string $password): array
    {
        $admin = Admin::findByUsername($username);

        if (!$admin || !password_verify($password, $admin['password_hash'])) {
            throw new \InvalidArgumentException('Invalid credentials');
        }

        Session::regenerate();
        Session::set('admin_id', (int) $admin['id']);

        return ['id' => (int) $admin['id'], 'username' => $admin['username']];
    }

    public static function logout(): void
    {
        Session::destroy();
    }

    public static function changePassword(int $userId, string $currentPassword, string $newPassword): void
    {
        $user = User::findByIdFull($userId);
        if (!$user) {
            throw new \InvalidArgumentException('User not found');
        }

        if (!password_verify($currentPassword, $user['password_hash'])) {
            throw new \InvalidArgumentException('Current password is incorrect');
        }

        if (strlen($newPassword) < 8) {
            throw new \InvalidArgumentException('New password must be at least 8 characters');
        }

        $hash = password_hash($newPassword, PASSWORD_ARGON2ID);
        User::updatePassword($userId, $hash);
    }
}
