<?php

declare(strict_types=1);

use App\Core\Env;

return [
    'base_url'       => Env::get('APP_BASE_URL', 'https://short.opensource.dev.br'),
    'session_name'   => 'OPENSHORTENER_SID',
    'rate_limit'     => [
        'window'  => 60,   // seconds
        'max_hits' => 30,  // requests per window
    ],
    'short_code_len' => 5,
    'cors_origin'    => Env::get('CORS_ORIGIN', '*'),

    // ── Captcha (Cloudflare Turnstile) ─────────────────────────
    // After N successful shortens within `window_hours`, the next create
    // from the same actor (IP for anon, user_id for logged-in) requires a
    // Turnstile token. Set site_key + secret_key to enable; leave blank to
    // disable the captcha entirely.
    'captcha' => [
        'enabled'             => (bool) Env::get('CAPTCHA_ENABLED', '1'),
        'provider'            => 'turnstile',
        'site_key'            => Env::get('TURNSTILE_SITE_KEY', ''),
        'secret_key'          => Env::get('TURNSTILE_SECRET_KEY', ''),
        'anon_threshold'      => (int) Env::get('CAPTCHA_ANON_THRESHOLD', '5'),
        'user_threshold'      => (int) Env::get('CAPTCHA_USER_THRESHOLD', '10'),
        'window_hours'        => (int) Env::get('CAPTCHA_WINDOW_HOURS', '24'),
        'verify_url'          => 'https://challenges.cloudflare.com/turnstile/v0/siteverify',
    ],
];
