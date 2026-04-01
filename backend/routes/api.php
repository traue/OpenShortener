<?php

declare(strict_types=1);

use App\Controllers\AuthController;
use App\Controllers\UrlController;
use App\Controllers\AdminController;
use App\Controllers\RedirectController;
use App\Middleware\AuthMiddleware;
use App\Middleware\RateLimitMiddleware;

/** @var \App\Core\Router $router */

$rateLimit = [RateLimitMiddleware::class, 'check'];
$authUser  = [AuthMiddleware::class, 'user'];
$authAdmin = [AuthMiddleware::class, 'admin'];

// ── Auth (user) ────────────────────────────────────────────────
$router->post('/api/v1/register', [AuthController::class, 'register'], [$rateLimit]);
$router->post('/api/v1/login',    [AuthController::class, 'login'],    [$rateLimit]);
$router->post('/api/v1/logout',   [AuthController::class, 'logout']);
$router->get('/api/v1/me',        [AuthController::class, 'me']);
$router->put('/api/v1/password',   [AuthController::class, 'changePassword'], [$authUser]);

// ── URLs (authenticated user) ──────────────────────────────────
$router->post('/api/v1/shorten',       [UrlController::class, 'shorten'],  [$rateLimit]);
$router->get('/api/v1/my-urls',        [UrlController::class, 'myUrls'],   [$authUser]);
$router->put('/api/v1/urls/{id}',      [UrlController::class, 'update'],   [$authUser]);
$router->delete('/api/v1/urls/{id}',   [UrlController::class, 'delete'],   [$authUser]);
$router->get('/api/v1/urls/{id}/stats', [UrlController::class, 'stats'],   [$authUser]);

// ── Admin ──────────────────────────────────────────────────────
$router->post('/api/v1/admin/login',          [AdminController::class, 'login'],      [$rateLimit]);
$router->get('/api/v1/admin/me',              [AdminController::class, 'me'],          [$authAdmin]);
$router->get('/api/v1/admin/users',           [AdminController::class, 'listUsers'],  [$authAdmin]);
$router->post('/api/v1/admin/users',          [AdminController::class, 'createUser'], [$authAdmin]);
$router->delete('/api/v1/admin/users/{id}',   [AdminController::class, 'deleteUser'], [$authAdmin]);
$router->put('/api/v1/admin/users/{id}',      [AdminController::class, 'blockUser'],  [$authAdmin]);
$router->get('/api/v1/admin/users/{id}/urls', [AdminController::class, 'listUserUrls'], [$authAdmin]);
$router->get('/api/v1/admin/urls',            [AdminController::class, 'listUrls'],   [$authAdmin]);
$router->post('/api/v1/admin/urls',           [AdminController::class, 'createUrl'],  [$authAdmin]);
$router->put('/api/v1/admin/urls/{id}',       [AdminController::class, 'updateUrl'],  [$authAdmin]);
$router->delete('/api/v1/admin/urls/{id}',    [AdminController::class, 'deleteUrl'],  [$authAdmin]);
$router->get('/api/v1/admin/urls/{id}/stats', [AdminController::class, 'urlStats'],   [$authAdmin]);

// ── Public (redirect & QR) ─────────────────────────────────────
$router->get('/qr/{code}',  [RedirectController::class, 'qrCode']);
$router->get('/{code}',     [RedirectController::class, 'redirect']);
