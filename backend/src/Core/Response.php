<?php

declare(strict_types=1);

namespace App\Core;

final class Response
{
    public static function json(mixed $data, int $status = 200): void
    {
        http_response_code($status);
        echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        exit;
    }

    public static function error(string $message, int $status = 400): void
    {
        self::json(['error' => $message], $status);
    }

    public static function redirect(string $url, int $code = 302): void
    {
        http_response_code($code);
        header("Location: {$url}");
        exit;
    }
}
