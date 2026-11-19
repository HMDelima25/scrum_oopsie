FROM node:22-bookworm-slim
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY backend ./backend
COPY frontend ./frontend
ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV TRUST_PROXY=1
USER node
CMD ["npm", "start"]
