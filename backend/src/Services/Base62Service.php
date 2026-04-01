<?php

declare(strict_types=1);

namespace App\Services;

final class Base62Service
{
    private const CHARS = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';

    public static function encode(int $num): string
    {
        if ($num === 0) {
            return self::CHARS[0];
        }

        $result = '';
        $base = strlen(self::CHARS);

        while ($num > 0) {
            $result = self::CHARS[$num % $base] . $result;
            $num = intdiv($num, $base);
        }

        return $result;
    }

    public static function generateRandom(int $length = 6): string
    {
        $chars = self::CHARS;
        $max = strlen($chars) - 1;
        $code = '';
        for ($i = 0; $i < $length; $i++) {
            $code .= $chars[random_int(0, $max)];
        }
        return $code;
    }
}
