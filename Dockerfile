# ---- Stage 1: Builder ----
FROM node:24-slim AS builder

# Build tools required to compile @serialport/bindings-cpp native addon
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

# Activate the exact pnpm version pinned in package.json
RUN corepack enable && corepack prepare pnpm --activate

WORKDIR /app

# Install dependencies first (layer-cached until lockfile changes)
COPY package.json pnpm-lock.yaml .npmrc ./
RUN pnpm install --frozen-lockfile

# Copy source and build:
#   prebuild → pnpm generate (fetches CLI.md, emits src/generated/variables.ts)
#   build    → tsc (emits dist/)
COPY tsconfig.json ./
COPY src/ ./src/
COPY scripts/ ./scripts/
RUN pnpm build

# Remove devDependencies to keep the copied node_modules lean
RUN pnpm prune --prod

# ---- Stage 2: Runtime ----
FROM node:24-slim AS runtime

# libudev1 is required by @serialport/bindings-cpp at runtime for port enumeration
RUN apt-get update && apt-get install -y --no-install-recommends \
    libudev1 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy pre-compiled node_modules (native bindings are binary-compatible:
# both stages share the same node:24-slim base and glibc version)
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY package.json ./

# This server communicates over stdio — there is no port to expose.
# Claude Desktop (or any MCP host) launches it as a subprocess and pipes
# stdin/stdout for JSON-RPC. Serial device access is granted at runtime via
# `docker run --device /dev/ttyACM0:/dev/ttyACM0` (see README.md).
CMD ["node", "dist/server.js"]
