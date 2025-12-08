FROM node:24 AS base

RUN corepack enable

FROM base AS dev

WORKDIR /app
COPY package.json yarn.lock .yarnrc.yml ./
COPY .yarn/releases .yarn/releases
RUN yarn install --immutable

COPY . .
CMD ["yarn", "dev"]

FROM base AS builder
ARG NEXT_PUBLIC_IS_PRODUCTION=false
ARG ENABLE_SENTRY=false
ARG SENTRY_AUTH_TOKEN
ARG GITHUB_SHA
ARG REDIS_URL=redis://frontend-cache.flathub.svc.cluster.local:6379

ENV GITHUB_SHA=$GITHUB_SHA
ENV REDIS_URL=$REDIS_URL
ENV PLT_NEXT_WORKERS=1
ENV PLT_SERVER_LOGGER_LEVEL=info

WORKDIR /app
COPY --from=dev /app/node_modules ./node_modules
COPY . .

RUN npx wattpm build
RUN yarn postbuild

FROM node:24-slim AS prod
ARG NEXT_PUBLIC_IS_PRODUCTION=false
ARG GITHUB_SHA

ENV GITHUB_SHA=$GITHUB_SHA
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV PLT_SERVER_LOGGER_LEVEL=info
ENV PLT_NEXT_WORKERS=1
EXPOSE 3000

RUN addgroup --system --gid 1001 nextjs && \
  adduser --system --uid 1001 nextjs

WORKDIR /app
COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/watt.json ./watt.json
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder --chown=nextjs:nextjs /app/.next ./.next
COPY --from=builder --chown=nextjs:nextjs /app/src/data ./src/data
RUN chown -R 1001:0 /app/.next && chgrp -R 0 /app && chmod -R g=u /app

USER nextjs
CMD ["node", "node_modules/.bin/wattpm", "start"]
