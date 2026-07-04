# ---- Stage 1: Builder ----
FROM node:24-slim AS builder

# No C/C++ toolchain needed: @serialport/bindings-cpp ships prebuilt native
# binaries (via prebuildify) for linux-x64/arm64 glibc, so node-gyp-build
# resolves a prebuild instead of compiling from source.

# Activate the exact pnpm version pinned in package.json
RUN corepack enable && corepack prepare pnpm --activate

WORKDIR /app

# Install dependencies first (layer-cached until lockfile changes)
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

# Copy source and build:
#   prebuild → pnpm generate (fetches settings.c/parameter_names.h remotely,
#              reads plugin/skills/betaflight-pid-tuning/references/betaflight-docs/wiki/cli-reference.md
#              locally, emits src/generated/variables.ts)
#   build    → tsc (emits dist/)
COPY tsconfig.json ./
COPY src/ ./src/
COPY scripts/ ./scripts/
COPY plugin/ ./plugin/
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
