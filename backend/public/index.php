<?php

declare(strict_types=1);

// ── Auto-detect paths (development vs production) ─────────────
$vendorPath = file_exists(__DIR__ . '/../vendor/autoload.php') 
    ? __DIR__ . '/../vendor/autoload.php'   // Development (backend/public/)
    : __DIR__ . '/vendor/autoload.php';      // Production (api/)

$envPath = file_exists(__DIR__ . '/../.env')
    ? __DIR__ . '/../.env'                   // Development
    : __DIR__ . '/.env';                     // Production

$configPath = file_exists(__DIR__ . '/../config/app.php')
    ? __DIR__ . '/../config/app.php'         // Development
    : __DIR__ . '/config/app.php';           // Production

require_once $vendorPath;

use App\Core\Database;
use App\Core\Env;
use App\Core\Router;
use App\Core\Session;

// ── Error reporting ────────────────────────────────────────────
error_reporting(E_ALL);
ini_set('display_errors', '0');
ini_set('log_errors', '1');

// ── Timezone (server-side is always UTC) ───────────────────────
date_default_timezone_set('UTC');

// ── Environment ────────────────────────────────────────────────
Env::load($envPath);

// ── Config ─────────────────────────────────────────────────────
$appConfig = require $configPath;

// ── CORS ───────────────────────────────────────────────────────
$origin = $appConfig['cors_origin'];
header("Access-Control-Allow-Origin: {$origin}");
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, X-CSRF-Token');
header('Access-Control-Allow-Credentials: true');

// Default Content-Type only for API routes; redirect/QR controllers
// set their own (text/html or image/png) and must not be overridden.
$rawPath = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?? '/';
if (str_starts_with($rawPath, '/api/')) {
    header('Content-Type: application/json; charset=utf-8');
}

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

// ── Database ───────────────────────────────────────────────────
Database::init([
    'host'     => Env::get('DB_HOST', '127.0.0.1'),
    'port'     => Env::get('DB_PORT', '3306'),
    'dbname'   => Env::get('DB_NAME', 'openshortener'),
    'username' => Env::get('DB_USER', 'root'),
    'password' => Env::get('DB_PASS', ''),
    'charset'  => 'utf8mb4',
]);

// ── Session ────────────────────────────────────────────────────
Session::start($appConfig['session_name']);

// ── Routing ────────────────────────────────────────────────────
$router = new Router();

$routesPath = file_exists(__DIR__ . '/../routes/api.php')
    ? __DIR__ . '/../routes/api.php'         // Development
    : __DIR__ . '/routes/api.php';           // Production

require $routesPath;

$method = $_SERVER['REQUEST_METHOD'];
$uri    = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);

$router->dispatch($method, $uri);
