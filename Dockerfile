FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.base.json tsconfig.json tsconfig.server.json tsup.config.ts vite.config.ts index.html ./
COPY src src
RUN npm run build

FROM node:22-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY --from=build /app/dist dist
COPY drizzle drizzle
USER node
EXPOSE 3000
CMD ["node", "dist/server/main.js"]
