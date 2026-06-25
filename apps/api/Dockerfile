FROM node:22-alpine AS builder
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/types/package.json ./packages/types/
COPY apps/api/package.json ./apps/api/
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate && pnpm install --frozen-lockfile --ignore-scripts
COPY packages/types/ ./packages/types/
COPY apps/api/ ./apps/api/
RUN pnpm --filter @realwise/api build

FROM node:22-alpine AS runner
WORKDIR /app
COPY --from=builder /app/apps/api/dist ./dist
COPY --from=builder /app/apps/api/package.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/api/node_modules ./node_modules
ENV PORT=3001
EXPOSE 3001
CMD ["node", "dist/main"]
