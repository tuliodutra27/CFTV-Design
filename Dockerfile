# Dockerfile de desenvolvimento — roda `next dev` com hot-reload via bind mount (ver docker-compose.yml).
# Uma imagem de produção (multi-stage, `next build` + `next start`) fica para a Fase 3/4 do planejamento.
FROM node:20-alpine

WORKDIR /app

# Necessário para o Prisma engine no Alpine
RUN apk add --no-cache libc6-compat openssl

COPY package.json package-lock.json* ./
RUN npm install

COPY . .
RUN npx prisma generate

EXPOSE 3000

CMD ["npm", "run", "dev"]
