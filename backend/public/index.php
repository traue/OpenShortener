<?php

declare(strict_types=1);

require_once __DIR__ . '/../vendor/autoload.php';

use App\Core\Database;
use App\Core\Env;
use App\Core\Router;
use App\Core\Session;

// ── Error reporting ────────────────────────────────────────────
error_reporting(E_ALL);
ini_set('display_errors', '0');
ini_set('log_errors', '1');

// ── Environment ────────────────────────────────────────────────
Env::load(__DIR__ . '/../.env');

// ── Config ─────────────────────────────────────────────────────
$appConfig = require __DIR__ . '/../config/app.php';

// ── CORS ───────────────────────────────────────────────────────
$origin = $appConfig['cors_origin'];
header("Access-Control-Allow-Origin: {$origin}");
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, X-CSRF-Token');
header('Access-Control-Allow-Credentials: true');
header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

// ── Database ───────────────────────────────────────────────────
Database::init([
    'host'     => Env::get('DB_HOST', '127.0.0.1'),
    'port'     => Env::get('DB_PORT', '3306'),
    'dbname'   => Env::get('DB_NAME', 'openshortner'),
    'username' => Env::get('DB_USER', 'root'),
    'password' => Env::get('DB_PASS', ''),
    'charset'  => 'utf8mb4',
]);

// ── Session ────────────────────────────────────────────────────
Session::start($appConfig['session_name']);

// ── Routing ────────────────────────────────────────────────────
$router = new Router();
require __DIR__ . '/../routes/api.php';

$method = $_SERVER['REQUEST_METHOD'];
$uri    = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);

$router->dispatch($method, $uri);
