<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Core\Response;
use App\Models\ClickLog;
use App\Models\Url;
use App\Services\QrCodeService;
use App\Services\UrlService;

final class RedirectController
{
    public function redirect(array $params): void
    {
        $code = $params['code'] ?? '';

        $url = UrlService::resolve($code);

        if (!$url) {
            $this->renderExpiredPage($code);
            return;
        }

        // Log click details
        $ip = $_SERVER['HTTP_X_REAL_IP'] ?? $_SERVER['HTTP_X_FORWARDED_FOR'] ?? $_SERVER['REMOTE_ADDR'] ?? null;
        $referer = $_SERVER['HTTP_REFERER'] ?? null;
        $ua = $_SERVER['HTTP_USER_AGENT'] ?? null;
        ClickLog::create((int) $url['id'], $ip, $referer, $ua);

        Response::redirect($url['original_url'], 302);
    }

    public function qrCode(array $params): void
    {
        $code = $params['code'] ?? '';
        $cfg = require __DIR__ . '/../../config/app.php';

        $url = Url::findByCode($code);

        if (!$url) {
            Response::error('Not found', 404);
        }

        if (UrlService::isExpired($url['expires_at'] ?? null)) {
            Response::error('Link expired', 410);
        }

        $shortUrl = $cfg['base_url'] . '/' . $code;
        $png = QrCodeService::generateRaw($shortUrl);

        header('Content-Type: image/png');
        header('Cache-Control: public, max-age=86400');
        http_response_code(200);
        echo $png;
        exit;
    }

    private function renderExpiredPage(string $code): void
    {
        // The frontend (expired.html) is served by a separate web server in
        // most setups (Docker, split frontend/backend deploys), so we can't
        // readfile() it from here. Redirect to the static page instead and
        // let it pick up the offending code from the ?code= query param.
        $target = '/expired.html?code=' . rawurlencode($code);
        header('Location: ' . $target, true, 302);
        header('Cache-Control: no-store');
        exit;
    }
}
