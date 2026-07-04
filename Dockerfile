# Express + Prisma API for DIY Network.
# Works on any Docker host (Render, Railway, Fly, etc).
FROM node:20-slim

WORKDIR /app

# Prisma needs OpenSSL at runtime.
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

# Install deps first (better layer caching). prisma/ is copied before npm ci
# so the postinstall "prisma generate" hook can find the schema.
COPY package*.json ./
COPY prisma ./prisma
RUN npm ci

# Build the TypeScript sources.
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

ENV NODE_ENV=production
# The platform injects PORT; the app reads process.env.PORT (default 5000).
EXPOSE 5000

# Apply any pending migrations, then start the server.
CMD ["npm", "run", "start:prod"]
