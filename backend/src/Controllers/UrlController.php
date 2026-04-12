<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Core\Request;
use App\Core\Response;
use App\Core\Session;
use App\Models\ClickLog;
use App\Models\Url;
use App\Services\CaptchaService;
use App\Services\QrCodeService;
use App\Services\UrlService;

final class UrlController
{
    public function shorten(array $params): void
    {
        $body = Request::body();
        $originalUrl = trim($body['url'] ?? '');
        $alias       = isset($body['alias']) ? trim($body['alias']) : null;
        $expiresAt   = isset($body['expires_at']) ? trim((string) $body['expires_at']) : null;
        $userId      = Session::get('user_id');

        if ($originalUrl === '') {
            Response::error('URL is required', 422);
        }

        // Captcha throttling — after N creates within the window, require a Turnstile token.
        [$scope, $actor] = $userId
            ? ['user', (string) $userId]
            : ['ip', (string) \App\Core\Request::ip()];

        if (CaptchaService::isRequired($scope, $actor)) {
            $token = (string) ($body['captcha_token'] ?? '');
            if (!CaptchaService::verifyToken($token, \App\Core\Request::ip())) {
                Response::json([
                    'error'            => 'Captcha required',
                    'captcha_required' => true,
                    'site_key'         => CaptchaService::siteKey(),
                ], 428);
                return;
            }
        }

        try {
            $result = UrlService::shorten($originalUrl, $alias, $expiresAt, $userId ? (int) $userId : null);

            // Count successful creates toward the captcha threshold
            CaptchaService::recordHit($scope, $actor);

            // Generate QR Code
            $qr = QrCodeService::generate($result['short_url']);
            $result['qr_code'] = $qr;

            Response::json($result, 201);
        } catch (\InvalidArgumentException $e) {
            Response::error($e->getMessage(), 422);
        }
    }

    public function captchaStatus(array $params): void
    {
        $userId = Session::get('user_id');
        [$scope, $actor] = $userId
            ? ['user', (string) $userId]
            : ['ip', (string) \App\Core\Request::ip()];

        Response::json([
            'enabled'   => CaptchaService::isEnabled(),
            'required'  => CaptchaService::isRequired($scope, $actor),
            'site_key'  => CaptchaService::siteKey(),
            'hits'      => CaptchaService::currentHits($scope, $actor),
            'threshold' => CaptchaService::thresholdFor($scope),
        ]);
    }

    public function myUrls(array $params): void
    {
        $userId = (int) Session::get('user_id');
        $cfg = require __DIR__ . '/../../config/app.php';

        $page    = max(1, (int) ($_GET['page'] ?? 1));
        $perPage = min(100, max(1, (int) ($_GET['per_page'] ?? 10)));
        $search  = isset($_GET['q']) ? trim((string) $_GET['q']) : null;
        $offset  = ($page - 1) * $perPage;

        $result = Url::findByUserPaged($userId, $perPage, $offset, $search);

        $mapped = array_map(function ($u) use ($cfg) {
            $u['short_url'] = $cfg['base_url'] . '/' . $u['short_code'];
            return $u;
        }, $result['rows']);

        Response::json([
            'data'     => $mapped,
            'total'    => $result['total'],
            'page'     => $page,
            'per_page' => $perPage,
        ]);
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
            try {
                $fields['expires_at'] = UrlService::parseExpiresAt($body['expires_at']);
            } catch (\InvalidArgumentException $e) {
                Response::error($e->getMessage(), 422);
            }
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

    public function stats(array $params): void
    {
        $id = (int) ($params['id'] ?? 0);
        $userId = Session::get('user_id');

        $url = Url::findById($id);
        if (!$url || (int) $url['user_id'] !== $userId) {
            Response::error('Not found', 404);
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
