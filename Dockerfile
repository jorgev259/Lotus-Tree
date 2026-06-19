FROM node:24-alpine AS build
WORKDIR /app
COPY package*.json yarn.lock tsconfig.json ./
RUN yarn install --frozen-lockfile
COPY src/ src/
RUN yarn build:app

FROM node:24-alpine
WORKDIR /app
COPY package*.json yarn.lock start.sh ./
COPY src/config dist/config/
COPY src/config /app/default-config/
COPY package*.json yarn.lock /app/default-project/
COPY docker-entrypoint.sh /app/docker-entrypoint.sh
RUN chmod +x /app/docker-entrypoint.sh
RUN yarn install --frozen-lockfile --production
COPY --from=build /app/dist/ dist/
ENTRYPOINT ["/app/docker-entrypoint.sh"]
CMD ["./start.sh"]
