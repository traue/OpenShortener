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
];
