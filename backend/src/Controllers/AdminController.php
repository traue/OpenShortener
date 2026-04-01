<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Core\Request;
use App\Core\Response;
use App\Core\Session;
use App\Models\ClickLog;
use App\Models\Url;
use App\Models\User;
use App\Services\AuthService;
use App\Services\UrlService;

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
            Response::error('Cannot modify your own account', 422);
            return;
        }
        $user = User::findById($id);
        if (!$user) {
            Response::error('User not found', 404);
            return;
        }

        $body = Request::body();
        $fields = [];

        if (array_key_exists('is_active', $body)) {
            $fields['is_active'] = $body['is_active'] ? 1 : 0;
        }
        if (array_key_exists('is_admin', $body)) {
            $fields['is_admin'] = $body['is_admin'] ? 1 : 0;
        }
        if (isset($body['email'])) {
            $email = trim($body['email']);
            if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
                Response::error('Invalid email', 422);
                return;
            }
            $existing = User::findByEmail($email);
            if ($existing && (int) $existing['id'] !== $id) {
                Response::error('Email already in use', 422);
                return;
            }
            $fields['email'] = $email;
        }
        if (isset($body['password']) && $body['password'] !== '') {
            if (strlen($body['password']) < 8) {
                Response::error('Password must be at least 8 characters', 422);
                return;
            }
            $fields['password_hash'] = password_hash($body['password'], PASSWORD_ARGON2ID);
        }

        if (empty($fields)) {
            Response::error('No fields to update', 422);
            return;
        }

        User::updateUser($id, $fields);
        Response::json(['message' => 'User updated']);
    }

    public function createUser(array $params): void
    {
        $body = Request::body();
        $email = trim($body['email'] ?? '');
        $password = $body['password'] ?? '';
        $isAdmin = (bool) ($body['is_admin'] ?? false);

        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            Response::error('Invalid email', 422);
            return;
        }
        if (strlen($password) < 8) {
            Response::error('Password must be at least 8 characters', 422);
            return;
        }
        if (User::findByEmail($email)) {
            Response::error('Email already exists', 422);
            return;
        }

        $hash = password_hash($password, PASSWORD_ARGON2ID);
        $id = User::create($email, $hash);

        if ($isAdmin) {
            User::updateUser($id, ['is_admin' => 1]);
        }

        Response::json(['message' => 'User created', 'id' => $id], 201);
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

    public function createUrl(array $params): void
    {
        $body = Request::body();
        $originalUrl = trim($body['url'] ?? '');
        $alias = isset($body['alias']) ? trim($body['alias']) : null;
        $expiresAt = isset($body['expires_at']) ? trim($body['expires_at']) : null;
        $userId = isset($body['user_id']) ? (int) $body['user_id'] : null;

        if ($originalUrl === '') {
            Response::error('URL is required', 422);
            return;
        }

        try {
            $result = UrlService::shorten($originalUrl, $alias, $expiresAt, $userId);
            Response::json($result, 201);
        } catch (\InvalidArgumentException $e) {
            Response::error($e->getMessage(), 422);
        }
    }

    public function updateUrl(array $params): void
    {
        $id = (int) ($params['id'] ?? 0);
        $url = Url::findById($id);
        if (!$url) {
            Response::error('URL not found', 404);
            return;
        }

        $body = Request::body();
        $fields = [];

        if (isset($body['url'])) {
            $ov = trim($body['url']);
            if (!filter_var($ov, FILTER_VALIDATE_URL)) {
                Response::error('Invalid URL', 422);
                return;
            }
            $fields['original_url'] = $ov;
        }
        if (isset($body['alias'])) {
            $alias = trim($body['alias']);
            if (!preg_match('/^[a-zA-Z0-9_\-]+$/', $alias)) {
                Response::error('Invalid alias', 422);
                return;
            }
            if ($alias !== $url['short_code'] && Url::codeExists($alias)) {
                Response::error('Alias already in use', 422);
                return;
            }
            $fields['short_code'] = $alias;
        }
        if (array_key_exists('expires_at', $body)) {
            $fields['expires_at'] = $body['expires_at'];
        }
        if (array_key_exists('is_active', $body)) {
            $fields['is_active'] = $body['is_active'] ? 1 : 0;
        }

        if (empty($fields)) {
            Response::error('No fields to update', 422);
            return;
        }

        Url::update($id, $fields);
        Response::json(['message' => 'URL updated']);
    }

    public function urlStats(array $params): void
    {
        $id = (int) ($params['id'] ?? 0);
        $url = Url::findById($id);
        if (!$url) {
            Response::error('URL not found', 404);
            return;
        }

        $clicksByDay = ClickLog::clicksByDay($id, 30);
        $topReferers = ClickLog::topReferers($id, 10);
        $totalClicks = (int) $url['clicks'];

        Response::json([
            'total_clicks'  => $totalClicks,
            'clicks_by_day' => $clicksByDay,
            'top_referers'  => $topReferers,
        ]);
    }
}
