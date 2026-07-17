FROM node:20-alpine

WORKDIR /app

ENV NODE_ENV=production
ENV DATA_DIR=/data

COPY package.json pnpm-lock.yaml ./
RUN corepack enable && pnpm install --prod --frozen-lockfile

COPY server.js ./
COPY index.html product.html checkout.html account.html ultimi-disponibili.html admin.html termini.html spedizioni.html privacy.html ./
COPY styles.css script.js i18n.js account.js admin.js ./
COPY assets ./assets

EXPOSE 8080

CMD ["node", "server.js"]
