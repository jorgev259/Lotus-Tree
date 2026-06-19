FROM node:24-alpine AS build
WORKDIR /app
COPY package*.json yarn.lock tsconfig.json ./
RUN yarn install --frozen-lockfile
COPY src/ src/
RUN yarn build:app

FROM node:24-alpine
WORKDIR /app
COPY package*.json yarn.lock ./
RUN yarn install --frozen-lockfile --production
COPY --from=build /app/dist/ dist/
CMD ["node", "dist/lotus/app.js"]
