# DollarCord self-hosted node.
# Single self-contained image: Next.js app + Socket.IO signaling on one port.
# WebRTC voice/video/screen is peer-to-peer (mesh), so no media port is needed on
# the server — only optional STUN/TURN for NAT traversal.

# ---- build stage ----
FROM node:20-alpine AS builder
RUN apk add --no-cache openssl libc6-compat
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci || npm install
COPY . .
# Generate Prisma client + build Next.
RUN npx prisma generate && npm run build

# ---- runtime stage ----
FROM node:20-alpine AS runner
RUN apk add --no-cache openssl libc6-compat
WORKDIR /app
ENV NODE_ENV=production

# server.js transpiles the TypeScript server at runtime via tsx, so we keep the
# full app + node_modules (including tsx) rather than pruning dev deps.
COPY --from=builder /app ./

# Defaults — override in compose / your environment.
ENV PORT=3000 \
    SELF_HOSTED=true \
    DATABASE_URL="file:/data/db/dollarcord.db" \
    UPLOAD_ROOT="/data/uploads"

EXPOSE 3000

# Ensure the data dirs exist, apply migrations, then start.
CMD ["sh", "-c", "mkdir -p /data/db /data/uploads && npm run start"]
