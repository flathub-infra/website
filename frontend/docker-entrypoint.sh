#!/bin/bash
[[ ! -d /app/.next || -z "$(ls -A /app/.next)" ]] && yarn build
yarn start
