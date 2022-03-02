FROM node:16 as dev

WORKDIR /app
COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile

COPY . .
CMD ["yarn", "dev"]

FROM node:16 as builder

WORKDIR /app
COPY --from=dev /app/node_modules ./node_modules
COPY . .

RUN yarn build

FROM node:16-slim as prod

ENV NODE_ENV production
ENV PORT 3000

WORKDIR /app
COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

EXPOSE 3000
CMD ["node", "server.js"]
