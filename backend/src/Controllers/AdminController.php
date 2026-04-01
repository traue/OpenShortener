<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Core\Request;
use App\Core\Response;
use App\Core\Session;
use App\Models\Url;
use App\Models\User;
use App\Services\AuthService;

final class AdminController
{
    public function login(array $params): void
    {
        $body = Request::body();
        $email    = trim($body['email'] ?? '');
        $password = $body['password'] ?? '';

        try {
            $admin = AuthService::adminLogin($email, $password);
            Response::json(['admin' => $admin]);
        } catch (\InvalidArgumentException $e) {
            Response::error($e->getMessage(), 401);
        }
    }

    public function me(array $params): void
    {
        $userId = Session::get('user_id');
        if (!$userId) { Response::error('Unauthorized', 401); return; }
        $user = User::findById($userId);
        if (!$user || !(int) $user['is_admin']) {
            Response::error('Unauthorized', 401);
            return;
        }
        Response::json(['admin' => ['id' => (int) $user['id'], 'email' => $user['email']]]);
    }

    public function listUsers(array $params): void
    {
        $users = User::all();
        Response::json($users);
    }

    public function deleteUser(array $params): void
    {
        $id = (int) ($params['id'] ?? 0);
        $currentUserId = (int) Session::get('user_id');
        if ($id === $currentUserId) {
            Response::error('Cannot delete your own account', 422);
            return;
        }
        $user = User::findById($id);
        if (!$user) {
            Response::error('User not found', 404);
            return;
        }
        User::delete($id);
        Response::json(['message' => 'User deleted']);
    }

    public function blockUser(array $params): void
    {
        $id = (int) ($params['id'] ?? 0);
        $currentUserId = (int) Session::get('user_id');
        if ($id === $currentUserId) {
            Response::error('Cannot block your own account', 422);
            return;
        }
        $user = User::findById($id);
        if (!$user) {
            Response::error('User not found', 404);
            return;
        }

        $body = Request::body();
        $active = (bool) ($body['is_active'] ?? false);
        User::toggleActive($id, $active);
        Response::json(['message' => $active ? 'User activated' : 'User blocked']);
    }

    public function listUrls(array $params): void
    {
        $cfg = require __DIR__ . '/../../config/app.php';
        $urls = Url::allWithOwner();
        $mapped = array_map(function ($u) use ($cfg) {
            $u['short_url'] = $cfg['base_url'] . '/' . $u['short_code'];
            return $u;
        }, $urls);
        Response::json($mapped);
    }

    public function listUserUrls(array $params): void
    {
        $userId = (int) ($params['id'] ?? 0);
        $user = User::findById($userId);
        if (!$user) {
            Response::error('User not found', 404);
            return;
        }
        $cfg = require __DIR__ . '/../../config/app.php';
        $urls = Url::findByUser($userId);
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
            return;
        }
        Url::delete($id);
        Response::json(['message' => 'URL deleted']);
    }
}
