FROM node:22-alpine AS builder
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/types/package.json ./packages/types/
COPY apps/web/package.json ./apps/web/
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate && pnpm install --frozen-lockfile --ignore-scripts
COPY packages/types/ ./packages/types/
COPY apps/web/ ./apps/web/
RUN pnpm --filter @realwise/web build

FROM nginx:alpine AS runner
COPY --from=builder /app/apps/web/dist /usr/share/nginx/html
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
