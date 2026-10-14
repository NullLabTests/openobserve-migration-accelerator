FROM node:22-alpine

WORKDIR /app
COPY loadgen.js ./

ENV TARGET_URL=http://checkout-api:8080
ENV LOADGEN_RPS=20

USER node
CMD ["node", "loadgen.js"]
