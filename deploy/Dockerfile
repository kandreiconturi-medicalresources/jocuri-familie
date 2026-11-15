# syntax=docker/dockerfile:1
# Imaginea Jocuri Familie: build web cu Vite + server Node. Context de build: rădăcina repo-ului.
#   docker build -f deploy/Dockerfile -t jocuri-familie .

# 1) Build-ul web (rulează pe platforma mașinii de build; rezultatul e același pentru orice arhitectură)
FROM --platform=$BUILDPLATFORM node:24-alpine AS web
WORKDIR /src
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
RUN npm run build

# 2) Dependențele serverului (doar `ws`, JavaScript pur)
FROM --platform=$BUILDPLATFORM node:24-alpine AS server-deps
WORKDIR /src/server
COPY server/package.json server/package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund

# 3) Imaginea finală: fără npm la rulare, fișierele aplicației aparțin lui root și nu pot fi modificate de proces
FROM node:24-alpine
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=8787 \
    DATA_DIR=/data \
    DIST_DIR=/app/dist
WORKDIR /app
COPY --from=server-deps /src/server/node_modules ./server/node_modules
COPY server/package.json ./server/package.json
COPY server/src ./server/src
COPY server/public ./server/public
COPY --from=web /src/dist ./dist
VOLUME ["/data"]
USER node
EXPOSE 8787
HEALTHCHECK --interval=60s --timeout=5s --start-period=20s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:8787/api/health').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"]
CMD ["node", "--disable-warning=ExperimentalWarning", "server/src/index.js"]
