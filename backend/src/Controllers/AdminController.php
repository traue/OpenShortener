<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Core\Request;
use App\Core\Response;
use App\Models\Url;
use App\Models\User;
use App\Services\AuthService;

final class AdminController
{
    public function login(array $params): void
    {
        $body = Request::body();
        $username = trim($body['username'] ?? '');
        $password = $body['password'] ?? '';

        try {
            $admin = AuthService::adminLogin($username, $password);
            Response::json(['admin' => $admin]);
        } catch (\InvalidArgumentException $e) {
            Response::error($e->getMessage(), 401);
        }
    }

    public function listUsers(array $params): void
    {
        $users = User::all();
        Response::json($users);
    }

    public function deleteUser(array $params): void
    {
        $id = (int) ($params['id'] ?? 0);
        $user = User::findById($id);
        if (!$user) {
            Response::error('User not found', 404);
        }
        User::delete($id);
        Response::json(['message' => 'User deleted']);
    }

    public function blockUser(array $params): void
    {
        $id = (int) ($params['id'] ?? 0);
        $user = User::findById($id);
        if (!$user) {
            Response::error('User not found', 404);
        }

        $body = Request::body();
        $active = (bool) ($body['is_active'] ?? false);
        User::toggleActive($id, $active);
        Response::json(['message' => $active ? 'User activated' : 'User blocked']);
    }

    public function listUrls(array $params): void
    {
        $urls = Url::all();
        $cfg = require __DIR__ . '/../../config/app.php';
        $mapped = array_map(function ($u) use ($cfg) {
            $u['short_url'] = $cfg['base_url'] . '/' . $u['short_code'];
            return $u;
        }, $urls);
        Response::json($mapped);
    }

    public function deleteUrl(array $params): void
    {
        $id = (int) ($params['id'] ?? 0);
        $url = Url::findById($id);
        if (!$url) {
            Response::error('URL not found', 404);
        }
        Url::delete($id);
        Response::json(['message' => 'URL deleted']);
    }
}
