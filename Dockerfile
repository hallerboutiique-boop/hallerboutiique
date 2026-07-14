FROM node:20-alpine

WORKDIR /app

ENV NODE_ENV=production
ENV DATA_DIR=/data

COPY package.json server.js ./
COPY index.html checkout.html account.html admin.html termini.html spedizioni.html privacy.html ./
COPY styles.css script.js account.js admin.js ./
COPY assets ./assets

EXPOSE 8080

CMD ["node", "server.js"]
