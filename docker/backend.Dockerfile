FROM php:8.3-apache

# Install system deps for GD (required by endroid/qr-code) and mariadb driver
RUN apt-get update && apt-get install -y --no-install-recommends \
        libpng-dev libjpeg-dev libfreetype6-dev libzip-dev unzip git \
    && docker-php-ext-configure gd --with-freetype --with-jpeg \
    && docker-php-ext-install gd pdo pdo_mysql zip \
    && a2enmod rewrite \
    && rm -rf /var/lib/apt/lists/*

# Install Composer
COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

# Set Apache document root to /var/www/html/public
ENV APACHE_DOCUMENT_ROOT=/var/www/html/public
RUN sed -ri -e 's!/var/www/html!${APACHE_DOCUMENT_ROOT}!g' \
    /etc/apache2/sites-available/*.conf /etc/apache2/apache2.conf /etc/apache2/conf-available/*.conf

WORKDIR /var/www/html

# Copy backend source
COPY backend/ .

# Install PHP dependencies
RUN composer install --no-dev --optimize-autoloader --no-interaction

# Fix permissions
RUN chown -R www-data:www-data /var/www/html

EXPOSE 80
