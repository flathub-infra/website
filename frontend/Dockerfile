FROM node:22 AS base

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

ENV GITHUB_SHA=$GITHUB_SHA

WORKDIR /app
COPY --from=dev /app/node_modules ./node_modules
COPY . .

RUN yarn build
RUN yarn postbuild

FROM node:22-slim AS prod
ARG NEXT_PUBLIC_IS_PRODUCTION=false
ARG GITHUB_SHA

ENV GITHUB_SHA=$GITHUB_SHA
ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

RUN addgroup --system --gid 1001 nextjs && \
  adduser --system --uid 1001 nextjs

WORKDIR /app
COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./package.json
COPY --from=builder --chown=nextjs:nextjs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nextjs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nextjs /app/src/data ./src/data
RUN chown -R 1001:0 /app/.next && chgrp -R 0 /app && chmod -R g=u /app

USER nextjs
CMD ["node", "server.js"]
