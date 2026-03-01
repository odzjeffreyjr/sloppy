FROM node:22-alpine AS base
RUN corepack enable

FROM base AS pruner
WORKDIR /app
RUN npm install -g turbo@^2
COPY . .
RUN turbo prune @sloppy/auth --docker

FROM base AS builder
WORKDIR /app
COPY --from=pruner /app/out/json/ .
RUN pnpm install --frozen-lockfile
COPY --from=pruner /app/out/full/ .
COPY --from=pruner /app/tsconfig.json ./tsconfig.json
COPY --from=pruner /app/turbo.json ./turbo.json
RUN pnpm turbo build --filter=@sloppy/auth...
RUN pnpm prune --prod

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup --system --gid 1001 sloppy && \
    adduser --system --uid 1001 sloppy
COPY --from=builder --chown=sloppy:sloppy /app .
USER sloppy
EXPOSE 3002
CMD ["node", "services/auth/dist/app.js"]
