FROM node:22-alpine AS base
RUN corepack enable

FROM base AS pruner
WORKDIR /app
RUN npm install -g turbo@^2
COPY . .
RUN turbo prune @sloppy/game-builder --docker

FROM base AS builder
WORKDIR /app
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
COPY --from=pruner /app/out/json/ .
RUN pnpm install --frozen-lockfile
COPY --from=pruner /app/out/full/ .
COPY --from=pruner /app/tsconfig.json ./tsconfig.json
COPY --from=pruner /app/turbo.json ./turbo.json
RUN find packages services -maxdepth 2 -name "package.json" -exec sh -c 'mkdir -p "$(dirname "$1")/.turbo"' _ {} \; \
    && pnpm turbo build --filter=@sloppy/game-builder... --no-daemon
RUN pnpm prune --prod

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production

RUN apk add --no-cache \
    vips-dev \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-freefont

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

RUN addgroup --system --gid 1001 sloppy && \
    adduser --system --uid 1001 sloppy
COPY --from=builder --chown=sloppy:sloppy /app .
USER sloppy
EXPOSE 3003
CMD ["node", "services/game-builder/dist/app.js"]
