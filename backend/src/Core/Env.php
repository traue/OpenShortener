<?php

declare(strict_types=1);

namespace App\Core;

final class Env
{
    private static array $vars = [];

    public static function load(string $path): void
    {
        if (!is_file($path)) {
            return;
        }

        $lines = file($path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);

        foreach ($lines as $line) {
            $line = trim($line);

            // Skip comments
            if ($line === '' || $line[0] === '#') {
                continue;
            }

            $pos = strpos($line, '=');
            if ($pos === false) {
                continue;
            }

            $key   = trim(substr($line, 0, $pos));
            $value = trim(substr($line, $pos + 1));

            // Remove surrounding quotes
            if (strlen($value) >= 2) {
                $first = $value[0];
                $last  = $value[strlen($value) - 1];
                if (($first === '"' && $last === '"') || ($first === "'" && $last === "'")) {
                    $value = substr($value, 1, -1);
                }
            }

            // Don't override existing environment variables (e.g. from Docker)
            $existing = getenv($key);
            if ($existing !== false && $existing !== '') {
                self::$vars[$key] = $existing;
                continue;
            }

            self::$vars[$key] = $value;
            $_ENV[$key] = $value;
            putenv("{$key}={$value}");
        }
    }

    public static function get(string $key, string $default = ''): string
    {
        return self::$vars[$key] ?? $_ENV[$key] ?? getenv($key) ?: $default;
    }
}
