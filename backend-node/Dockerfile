FROM node:22

WORKDIR /app

COPY package.json yarn.lock tsconfig.json .yarnrc.yml ./

COPY .yarn ./.yarn
COPY emails ./emails
COPY src ./src

RUN yarn install --immutable && \
    yarn build && \
    yarn cache clean

EXPOSE 8001

CMD ["node", "./dist/src/index.js"]