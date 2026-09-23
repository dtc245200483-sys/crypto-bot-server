# ==============================================================================
# Dockerfile - High-Performance & Hardened Security Container for OKX Crypto Bot
# Node.js 22 LTS Alpine (Lightweight, Minimal Attack Surface, Fast Execution)
# ==============================================================================

FROM node:22-alpine AS runner

# Cài đặt múi giờ Việt Nam và công cụ quản lý tiến trình dumb-init
RUN apk add --no-cache tzdata dumb-init
ENV TZ=Asia/Ho_Chi_Minh

# Đặt thư mục làm việc
WORKDIR /app

# Biến môi trường production
ENV NODE_ENV=production
ENV PORT=8787
ENV HOST=0.0.0.0

# Sao chép package.json và package-lock.json để tận dụng Docker layer caching
COPY package*.json ./

# Cài đặt toàn bộ dependencies production sạch và tối ưu
RUN npm ci --omit=dev && npm cache clean --force

# Sao chép toàn bộ mã nguồn
COPY . .

# Tạo thư mục data và logs, phân quyền cho non-root user 'node'
RUN mkdir -p /app/data /app/logs && chown -R node:node /app

# Chuyển sang non-root user (Bảo mật tối đa, chống leo thang đặc quyền container)
USER node

# Mở cổng dịch vụ
EXPOSE 8787

# Healthcheck định kỳ kiểm tra sức khỏe máy chủ
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://localhost:' + (process.env.PORT || 8787) + '/api/health').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

# Chạy với dumb-init để xử lý graceful shutdown (SIGTERM / SIGINT) an toàn
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "server.js"]
