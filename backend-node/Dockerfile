FROM node:20

WORKDIR /app

COPY package.json yarn.lock tsconfig.json ./

COPY emails ./emails
COPY src ./src

RUN yarn install --immutable && \
    yarn build && \
    yarn cache clean

EXPOSE 8001

CMD ["node", "./dist/src/index.js"]