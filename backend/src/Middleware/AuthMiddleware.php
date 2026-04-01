<?php

declare(strict_types=1);

namespace App\Middleware;

use App\Core\Response;
use App\Core\Session;

final class AuthMiddleware
{
    public static function user(): bool
    {
        if (!Session::has('user_id')) {
            Response::error('Unauthorized', 401);
            return false;
        }
        return true;
    }

    public static function admin(): bool
    {
        if (!Session::has('admin_id')) {
            Response::error('Unauthorized', 401);
            return false;
        }
        return true;
    }
}
