# ==================================================================
# Dockerfile — Product Service (Multi-stage Build)
# ==================================================================
#
# WHY MULTI-STAGE BUILD?
# Multi-stage builds reduce final image size by separating build dependencies
# from runtime dependencies. Build tools (npm, dev packages) are only in
# the builder stage and NOT in the final image.
#
# STAGES:
#   1. builder → Install dependencies and prepare production node_modules
#   2. runtime → Copy only what's needed to run the app (smaller, more secure)
#
# ==================================================================

# ──── Stage 1: Build ────
# Use Alpine Linux variant for smaller image size
FROM node:20-alpine AS builder

# Set working directory inside the container
WORKDIR /app

# Copy package files first (leverages Docker layer caching)
# If package.json hasn't changed, this layer is reused
COPY package*.json ./

# Install ONLY production dependencies (no devDependencies)
# Keeps the node_modules folder lean
RUN npm ci --only=production

# Copy application source code
COPY . .

# ──── Stage 2: Runtime ────
# Start fresh with a clean Alpine image (no build artifacts)
FROM node:20-alpine

# Create non-root user for security (runs container as 'appuser' not 'root')
# -S creates a system user, -G assigns it to a group
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

# Set working directory
WORKDIR /app

# Copy production node_modules from builder stage
# --from=builder references the first stage by name
COPY --from=builder /app/node_modules ./node_modules

# Copy application code from builder
COPY --from=builder /app/server.js ./

# Switch to non-root user (security best practice)
USER appuser

# Expose port 3001 for the product service
EXPOSE 3001

# Health check: Docker will periodically check if the app is healthy
# --interval=30s → Check every 30 seconds
# --timeout=5s → Fail if check takes more than 5 seconds
# --retries=3 → Mark unhealthy after 3 consecutive failures
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget -qO- http://localhost:3001/health || exit 1

# Start the Node.js server
CMD ["node", "server.js"]
