FROM node:12-alpine

ADD app /app

WORKDIR /app/

COPY * */
RUN npm install --production
COPY . ./

CMD ["node", "index.js"]
