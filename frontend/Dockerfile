FROM node:22 AS base

RUN corepack enable

FROM base AS deps

WORKDIR /app
COPY package.json yarn.lock .yarnrc.yml ./
COPY .yarn ./.yarn
RUN yarn install --immutable

FROM deps AS dev

WORKDIR /app
COPY . .
CMD ["yarn", "dev"]

FROM base AS builder
ARG NEXT_PUBLIC_IS_PRODUCTION=false
ARG ENABLE_SENTRY=false
ARG SENTRY_AUTH_TOKEN
ARG GITHUB_SHA

ENV GITHUB_SHA=$GITHUB_SHA

WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/.yarn ./.yarn
COPY --from=deps /app/.yarnrc.yml ./.yarnrc.yml
COPY --from=deps /app/package.json ./package.json
COPY --from=deps /app/yarn.lock ./yarn.lock
COPY . .

RUN yarn build

FROM deps AS prod-deps

WORKDIR /app
RUN yarn workspaces focus --all --production

FROM node:22-slim AS prod
ARG NEXT_PUBLIC_IS_PRODUCTION=false
ARG GITHUB_SHA

ENV GITHUB_SHA=$GITHUB_SHA
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
EXPOSE 3000

RUN apt-get update && \
  apt-get install -y --no-install-recommends libjemalloc2 && \
  rm -rf /var/lib/apt/lists/*

RUN addgroup --system --gid 1001 nextjs && \
  adduser --system --uid 1001 nextjs

WORKDIR /app
COPY --from=builder /app/package.json ./package.json
COPY --from=prod-deps --chown=nextjs:nextjs /app/node_modules ./node_modules
COPY --from=builder --chown=nextjs:nextjs /app/dist ./dist
COPY --from=builder --chown=nextjs:nextjs /app/src/data ./src/data
RUN chown -R 1001:0 /app && chgrp -R 0 /app && chmod -R g=u /app

USER nextjs
CMD ["node", "./node_modules/vinext/dist/cli.js", "start"]
