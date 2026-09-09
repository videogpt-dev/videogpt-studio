FROM node:24-bookworm-slim AS build
ENV CI=true
RUN corepack enable && corepack prepare pnpm@11.18.0 --activate
WORKDIR /repo
COPY . .
RUN pnpm install --prod --frozen-lockfile --filter vcs-editor-service...

FROM node:24-bookworm-slim AS runtime
RUN apt-get update && apt-get install -y --no-install-recommends \
      ffmpeg \
      libnss3 \
      libdbus-1-3 \
      libatk1.0-0 \
      libatk-bridge2.0-0 \
      libcups2 \
      libdrm2 \
      libxkbcommon0 \
      libxcomposite1 \
      libxdamage1 \
      libxfixes3 \
      libxrandr2 \
      libgbm1 \
      libasound2 \
      libpango-1.0-0 \
      libcairo2 \
      libatspi2.0-0 \
      fonts-dejavu-core \
      fonts-noto-core \
      ca-certificates \
    && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production \
    PORT=3000 \
    OUTPUT_DIR=/app/output
WORKDIR /repo
COPY --from=build /repo/node_modules ./node_modules
COPY --from=build /repo/apps/vcs-editor-service ./apps/vcs-editor-service
COPY --from=build /repo/packages/vcs-remotion ./packages/vcs-remotion
WORKDIR /repo/apps/vcs-editor-service

RUN ./node_modules/.bin/tsx -e "import('@remotion/renderer').then((m) => m.ensureBrowser()).then(() => process.exit(0), (e) => { console.error(e); process.exit(1); })"
EXPOSE 3000

CMD ["./node_modules/.bin/tsx", "src/server.ts"]
