FROM node:16

COPY . .

RUN yarn install
RUN yarn build

EXPOSE 3000

CMD [ "yarn", "start" ]
