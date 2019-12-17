FROM node:12-alpine

ADD app /app

WORKDIR /app/

RUN npm install --production

CMD ["node", "downloadAsset.js"]
