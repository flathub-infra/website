FROM node:14

COPY . .

RUN yarn install
RUN yarn build

EXPOSE 3000

CMD [ "yarn", "start" ]
