# Container image for the Vortex API. Use this when deploying to a container
# host (Fly.io, Cloudflare Containers, Railway, Render Docker, etc.).
# For Render's native Node runtime, no Dockerfile is needed — use `npm start`.
FROM node:22-bookworm-slim

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

ENV NODE_ENV=production
EXPOSE 5000

CMD ["npm", "start"]
