FROM node:24

RUN corepack enable pnpm

WORKDIR /app

COPY package.json pnpm-lock.yaml tsconfig.json ./

COPY emails ./emails
COPY src ./src

RUN pnpm install --frozen-lockfile && \
    pnpm build && \
    pnpm store prune

EXPOSE 8001

CMD ["node", "--enable-source-maps", "./dist/src/index.js"]