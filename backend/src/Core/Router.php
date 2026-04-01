<?php

declare(strict_types=1);

namespace App\Core;

final class Router
{
    private array $routes = [];

    public function add(string $method, string $pattern, callable|array $handler, array $middleware = []): void
    {
        $this->routes[] = [
            'method'     => strtoupper($method),
            'pattern'    => $pattern,
            'handler'    => $handler,
            'middleware'  => $middleware,
        ];
    }

    public function get(string $pattern, callable|array $handler, array $middleware = []): void
    {
        $this->add('GET', $pattern, $handler, $middleware);
    }

    public function post(string $pattern, callable|array $handler, array $middleware = []): void
    {
        $this->add('POST', $pattern, $handler, $middleware);
    }

    public function put(string $pattern, callable|array $handler, array $middleware = []): void
    {
        $this->add('PUT', $pattern, $handler, $middleware);
    }

    public function delete(string $pattern, callable|array $handler, array $middleware = []): void
    {
        $this->add('DELETE', $pattern, $handler, $middleware);
    }

    public function dispatch(string $method, string $uri): void
    {
        $method = strtoupper($method);

        foreach ($this->routes as $route) {
            if ($route['method'] !== $method) {
                continue;
            }

            $regex = $this->patternToRegex($route['pattern']);

            if (preg_match($regex, $uri, $matches)) {
                $params = array_filter($matches, 'is_string', ARRAY_FILTER_USE_KEY);

                // Run middleware chain
                foreach ($route['middleware'] as $mw) {
                    $result = call_user_func($mw);
                    if ($result === false) {
                        return;
                    }
                }

                // Call handler
                $handler = $route['handler'];
                if (is_array($handler)) {
                    [$class, $methodName] = $handler;
                    $instance = new $class();
                    call_user_func([$instance, $methodName], $params);
                } else {
                    call_user_func($handler, $params);
                }

                return;
            }
        }

        // No route matched
        http_response_code(404);
        echo json_encode(['error' => 'Not found']);
    }

    private function patternToRegex(string $pattern): string
    {
        // Convert {param} to named capture groups
        $regex = preg_replace('/\{([a-zA-Z_]+)\}/', '(?P<$1>[^/]+)', $pattern);
        return '#^' . $regex . '$#';
    }
}
