FROM node:22-alpine

WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install --omit=dev --no-audit --no-fund
COPY agent.js ./

USER node
CMD ["node", "agent.js"]
