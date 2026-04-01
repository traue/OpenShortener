<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Core\Request;
use App\Core\Response;
use App\Core\Session;
use App\Models\Url;
use App\Services\QrCodeService;
use App\Services\UrlService;

final class UrlController
{
    public function shorten(array $params): void
    {
        $body = Request::body();
        $originalUrl = trim($body['url'] ?? '');
        $alias       = isset($body['alias']) ? trim($body['alias']) : null;
        $expiresAt   = isset($body['expires_at']) ? trim($body['expires_at']) : null;
        $userId      = Session::get('user_id');

        if ($originalUrl === '') {
            Response::error('URL is required', 422);
        }

        try {
            $result = UrlService::shorten($originalUrl, $alias, $expiresAt, $userId);

            // Generate QR Code
            $qr = QrCodeService::generate($result['short_url']);
            $result['qr_code'] = $qr;

            Response::json($result, 201);
        } catch (\InvalidArgumentException $e) {
            Response::error($e->getMessage(), 422);
        }
    }

    public function myUrls(array $params): void
    {
        $userId = Session::get('user_id');
        $cfg = require __DIR__ . '/../../config/app.php';
        $urls = Url::findByUser($userId);

        $mapped = array_map(function ($u) use ($cfg) {
            $u['short_url'] = $cfg['base_url'] . '/' . $u['short_code'];
            return $u;
        }, $urls);

        Response::json($mapped);
    }

    public function update(array $params): void
    {
        $id = (int) ($params['id'] ?? 0);
        $userId = Session::get('user_id');

        $url = Url::findById($id);
        if (!$url || (int) $url['user_id'] !== $userId) {
            Response::error('Not found', 404);
        }

        $body = Request::body();
        $fields = [];

        if (isset($body['url'])) {
            $originalUrl = trim($body['url']);
            if (!filter_var($originalUrl, FILTER_VALIDATE_URL)) {
                Response::error('Invalid URL', 422);
            }
            $fields['original_url'] = $originalUrl;
        }

        if (isset($body['alias'])) {
            $alias = trim($body['alias']);
            if (!preg_match('/^[a-zA-Z0-9_\-]+$/', $alias)) {
                Response::error('Invalid alias', 422);
            }
            if ($alias !== $url['short_code'] && Url::codeExists($alias)) {
                Response::error('Alias already in use', 422);
            }
            $fields['short_code'] = $alias;
        }

        if (array_key_exists('expires_at', $body)) {
            $fields['expires_at'] = $body['expires_at'];
        }

        if (empty($fields)) {
            Response::error('No fields to update', 422);
        }

        Url::update($id, $fields);
        Response::json(['message' => 'Updated']);
    }

    public function delete(array $params): void
    {
        $id = (int) ($params['id'] ?? 0);
        $userId = Session::get('user_id');

        $url = Url::findById($id);
        if (!$url || (int) $url['user_id'] !== $userId) {
            Response::error('Not found', 404);
        }

        Url::delete($id);
        Response::json(['message' => 'Deleted']);
    }
}
