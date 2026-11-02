# =====================================================
# Dockerfile — Keripik Kentang Web App
# Security: non-root user, minimal base image
# =====================================================

# Base image: nginx alpine (minimal attack surface)
FROM nginx:1.27-alpine

# Metadata
LABEL maintainer="ragaakbar2460@gmail.com"
LABEL app="keripik-kentang"
LABEL version="1.0"

# Hapus default nginx config
RUN rm -rf /etc/nginx/conf.d/*

# Buat direktori web
WORKDIR /usr/share/nginx/html

# Hapus file default nginx
RUN rm -rf ./*

# Copy semua file web app
COPY . .

# Hapus file yang tidak perlu di production
RUN rm -f Dockerfile docker-compose.yml .dockerignore \
    firestore.rules storage.rules firebase.json .firebaserc

# Copy custom nginx config (security headers)
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Buat user non-root untuk keamanan
RUN addgroup -g 1001 -S appgroup && \
    adduser -u 1001 -S appuser -G appgroup && \
    chown -R appuser:appgroup /usr/share/nginx/html && \
    chown -R appuser:appgroup /var/cache/nginx && \
    chown -R appuser:appgroup /var/log/nginx && \
    touch /var/run/nginx.pid && \
    chown -R appuser:appgroup /var/run/nginx.pid

# Jalankan sebagai non-root
USER appuser

# Expose port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:8080/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
