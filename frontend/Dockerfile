FROM quay.io/hummingbird/nodejs:24-builder AS base

USER root
RUN npm install -g corepack && corepack enable pnpm && \
  dnf install -y jemalloc && dnf clean all

FROM base AS dev

WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .
CMD ["pnpm", "dev"]

FROM base AS builder
ARG NEXT_PUBLIC_IS_PRODUCTION=false
ARG ENABLE_SENTRY=false
ARG SENTRY_AUTH_TOKEN
ARG GITHUB_SHA

ENV GITHUB_SHA=$GITHUB_SHA

WORKDIR /app
COPY --from=dev /app/node_modules ./node_modules
COPY . .

RUN pnpm build

FROM quay.io/hummingbird/nodejs:24 AS prod
ARG NEXT_PUBLIC_IS_PRODUCTION=false
ARG GITHUB_SHA

ENV GITHUB_SHA=$GITHUB_SHA
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_OPTIONS=--max-old-space-size=2048
ENV PORT=3000
EXPOSE 3000

COPY --from=base /usr/lib64/libjemalloc.so.2 /usr/lib64/

USER root
WORKDIR /app
COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./package.json
COPY --from=builder --chown=1001:0 /app/.next/standalone ./
COPY --from=builder --chown=1001:0 /app/.next/static ./.next/static
COPY --from=builder --chown=1001:0 /app/src/data ./src/data
RUN chown -R 1001:0 /app/.next && chgrp -R 0 /app && chmod -R g=u /app

USER 1001
CMD ["node", "server.js"]
