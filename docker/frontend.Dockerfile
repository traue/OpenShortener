FROM nginx:alpine

# Copy frontend files
COPY frontend/ /usr/share/nginx/html/

# Copy custom nginx config
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
