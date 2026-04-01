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
            http_response_code(404);
            header('Content-Type: text/html; charset=utf-8');
            echo $this->expiredPage();
            exit;
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

        if ($url['expires_at'] !== null && strtotime($url['expires_at']) < time()) {
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

    private function expiredPage(): string
    {
        return <<<'HTML'
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Link not found</title>
    <style>
        *{margin:0;padding:0;box-sizing:border-box}
        body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;background:#0f172a;color:#e2e8f0}
        .card{text-align:center;padding:3rem 2rem;max-width:480px}
        h1{font-size:4rem;margin-bottom:1rem;color:#f43f5e}
        p{font-size:1.125rem;margin-bottom:2rem;color:#94a3b8}
        a{color:#38bdf8;text-decoration:none;font-weight:600}
        a:hover{text-decoration:underline}
    </style>
</head>
<body>
    <div class="card">
        <h1>404</h1>
        <p>This link does not exist or has expired.</p>
        <a href="/">&larr; Back to home</a>
    </div>
</body>
</html>
HTML;
    }
}
