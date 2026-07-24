FROM node:18-alpine

WORKDIR /usr/src/app

# Install dependencies first for better layer caching
COPY package*.json ./
RUN npm install --omit=dev

# Copy app source
COPY . .

EXPOSE 3000

CMD ["node", "app.js"]
