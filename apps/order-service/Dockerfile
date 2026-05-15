# =============================================================
# Dockerfile — order-service
# =============================================================
# MULTI-STAGE BUILD: Keeps the final image small and secure
#
# Stage 1 (builder): Install ALL npm dependencies including devDeps
# Stage 2 (runtime): Copy only production artifacts — no build tools
#
# Final image size: ~120MB vs ~400MB for single-stage
# =============================================================

# ---- Stage 1: Builder ----
# Use official Node 20 Alpine (minimal Linux, ~5MB base)
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files first (Docker layer caching optimization)
# If package.json hasn't changed, this layer is cached — saves time
COPY package*.json ./

# Install ONLY production dependencies (no jest, eslint, etc.)
# 'npm ci' is faster and more reliable than 'npm install' in CI/CD
RUN npm ci --only=production

# Copy source code AFTER npm install (so code changes don't bust dep cache)
COPY . .

# ---- Stage 2: Production Runtime ----
# Start fresh from a clean Alpine image — no build tools, no devDeps
FROM node:20-alpine

# Security: Create a non-root user to run the app
# NEVER run Node.js apps as root in production containers
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

WORKDIR /app

# Copy only what we need from the builder stage
COPY --from=builder /app/node_modules ./node_modules  # Production deps only
COPY --from=builder /app/server.js .                  # Application code

# Switch to non-root user (drops all root privileges)
USER appuser

# Declare which port this container listens on (documentation + K8s awareness)
EXPOSE 3002

# Kubernetes health check — Docker also uses this for 'docker ps' HEALTH column
# --interval=30s  : Check every 30 seconds
# --timeout=5s    : Fail if no response in 5 seconds
# --retries=3     : Mark unhealthy after 3 consecutive failures
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget -qO- http://localhost:3002/health || exit 1

# Start the Node.js server (exec form preferred — PID 1, handles signals cleanly)
CMD ["node", "server.js"]
