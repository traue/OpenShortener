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
}
