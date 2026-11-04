# Free IP-to-city database (DB-IP "City Lite", CC BY 4.0), read locally so no IP leaves the server. Best effort: if the
# download fails the image still builds and the API simply does not record locations.
FROM node:22-alpine AS geo
RUN mkdir -p /geo && \
    for ym in "$(date +%Y-%m)" "$(date -d @$(( $(date +%s) - 2678400 )) +%Y-%m)"; do \
      if wget -q -O /geo/city.mmdb.gz "https://download.db-ip.com/free/dbip-city-lite-${ym}.mmdb.gz" && gunzip -f /geo/city.mmdb.gz; then echo "geo db ${ym}"; break; fi; \
      rm -f /geo/city.mmdb.gz /geo/city.mmdb; \
    done; \
    ls -la /geo

FROM node:22-alpine AS builder
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/types/package.json ./packages/types/
COPY apps/api/package.json ./apps/api/
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate && pnpm install --frozen-lockfile --ignore-scripts
COPY packages/types/ ./packages/types/
COPY apps/api/ ./apps/api/
RUN pnpm --filter @realwise/api build
RUN pnpm --filter @realwise/api deploy --prod /app/deploy

FROM node:22-alpine AS runner
WORKDIR /app
COPY --from=builder /app/deploy/node_modules ./node_modules
COPY --from=builder /app/apps/api/dist ./dist
COPY --from=builder /app/apps/api/package.json ./
COPY --from=geo /geo ./geo
ENV PORT=3001
ENV GEO_DB_PATH=/app/geo/city.mmdb
EXPOSE 3001
CMD ["node", "dist/main"]
