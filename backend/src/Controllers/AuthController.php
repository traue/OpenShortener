<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Core\Request;
use App\Core\Response;
use App\Services\AuthService;

final class AuthController
{
    public function register(array $params): void
    {
        $body = Request::body();
        $email    = trim($body['email'] ?? '');
        $password = $body['password'] ?? '';

        try {
            $user = AuthService::register($email, $password);
            Response::json(['user' => $user], 201);
        } catch (\InvalidArgumentException $e) {
            Response::error($e->getMessage(), 422);
        }
    }

    public function login(array $params): void
    {
        $body = Request::body();
        $email    = trim($body['email'] ?? '');
        $password = $body['password'] ?? '';

        try {
            $user = AuthService::login($email, $password);
            Response::json(['user' => $user]);
        } catch (\InvalidArgumentException $e) {
            Response::error($e->getMessage(), 401);
        }
    }

    public function logout(array $params): void
    {
        AuthService::logout();
        Response::json(['message' => 'Logged out']);
    }

    public function me(array $params): void
    {
        $userId = \App\Core\Session::get('user_id');
        if (!$userId) {
            Response::error('Unauthorized', 401);
            return;
        }
        $user = \App\Models\User::findById($userId);
        if (!$user) {
            Response::error('Unauthorized', 401);
            return;
        }
        Response::json(['user' => ['id' => (int) $user['id'], 'email' => $user['email'], 'is_admin' => (bool) (int) ($user['is_admin'] ?? 0)]]);
    }

    public function changePassword(array $params): void
    {
        $userId = \App\Core\Session::get('user_id');
        if (!$userId) {
            Response::error('Unauthorized', 401);
            return;
        }

        $body = Request::body();
        $currentPassword = $body['current_password'] ?? '';
        $newPassword = $body['new_password'] ?? '';

        try {
            AuthService::changePassword($userId, $currentPassword, $newPassword);
            Response::json(['message' => 'Password updated']);
        } catch (\InvalidArgumentException $e) {
            Response::error($e->getMessage(), 422);
        }
    }
}
