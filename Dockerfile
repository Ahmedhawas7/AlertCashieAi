FROM node:18-slim

WORKDIR /app

RUN apt-get update && apt-get install -y curl sqlite3 python3 make g++ && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm ci

COPY . .
RUN npx prisma generate
RUN npm run build

EXPOSE 3000

CMD ["sh", "-c", "npx prisma db push && npm start"]
