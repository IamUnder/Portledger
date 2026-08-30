FROM node:20-bookworm-slim

RUN apt-get update && apt-get install -y --no-install-recommends git ca-certificates sqlite3 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package*.json ./
RUN npm install
COPY prisma ./prisma
RUN npx prisma generate
COPY . .
RUN npm run build

EXPOSE 4000
CMD ["sh", "-c", "npx prisma db push --skip-generate && npx tsx prisma/seed.ts && node dist/server.js"]
