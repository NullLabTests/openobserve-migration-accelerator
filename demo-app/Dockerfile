# Multi-stage-ish, single-stage slim build for the instrumented demo app.
FROM node:22-alpine

# Install production dependencies first so Docker can cache this layer.
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install --omit=dev --no-audit --no-fund

# Application source.
COPY src ./src

ENV NODE_ENV=production
ENV PORT=8080
EXPOSE 8080 8081

# Run as the unprivileged "node" user shipped with the official image.
USER node

CMD ["node", "src/index.js"]
