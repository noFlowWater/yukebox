FROM node:22-slim AS builder

RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src/ ./src/

RUN npm run build

# Re-install production-only deps (with native modules already buildable)
RUN rm -rf node_modules && npm ci --omit=dev

# --- Production image ---
FROM node:22-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    mpv \
    pulseaudio-utils \
    bluez \
    dbus \
    ca-certificates \
    curl \
    && ARCH=$(dpkg --print-architecture) \
    && if [ "$ARCH" = "amd64" ]; then YT_DLP_BIN="yt-dlp_linux"; \
       elif [ "$ARCH" = "arm64" ]; then YT_DLP_BIN="yt-dlp_linux_aarch64"; \
       else YT_DLP_BIN="yt-dlp"; fi \
    && curl -L "https://github.com/yt-dlp/yt-dlp/releases/latest/download/$YT_DLP_BIN" \
       -o /usr/local/bin/yt-dlp \
    && chmod +x /usr/local/bin/yt-dlp \
    && apt-get purge -y curl \
    && apt-get autoremove -y \
    && rm -rf /var/lib/apt/lists/* \
    && dbus-uuidgen > /etc/machine-id

WORKDIR /app

COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist

RUN mkdir -p /app/data

EXPOSE 4000

CMD ["node", "dist/server.js"]
