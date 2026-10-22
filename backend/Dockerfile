FROM node:22-bookworm-slim

RUN apt-get update && apt-get install -y --no-install-recommends git ca-certificates sqlite3 \
    && rm -rf /var/lib/apt/lists/*

# el panel opera sobre repos montados desde el host (dueños del propio usuario del host, no
# del contenedor), y git rechaza por defecto tocar un repo cuyo dueño no coincide con el uid
# actual ("detected dubious ownership") — aquí es una protección sin sentido, ya el contenedor
# ya tiene acceso de escritura a todo HOST_HOME y al socket de Docker.
RUN git config --system --add safe.directory '*'

WORKDIR /app
COPY package*.json ./
# npm 10 (el que trae node:22) peta en build-ideal-tree ("reading 'edgesOut'") con el árbol
# de dependencias de vitest desde oct-2026; npm 11 lo resuelve bien.
RUN npm install -g npm@11 && npm install
COPY prisma ./prisma
RUN npx prisma generate
COPY . .
RUN npm run build

EXPOSE 4000
CMD ["sh", "-c", "npx prisma db push --skip-generate && npx tsx prisma/seed.ts && node dist/server.js"]
