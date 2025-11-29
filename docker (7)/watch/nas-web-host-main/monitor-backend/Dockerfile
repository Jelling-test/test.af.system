FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies (uden at bruge package-lock)
RUN npm install --omit=dev

# Copy application files
COPY . .

# Expose ports
EXPOSE 3001 8090

# Start the server
CMD ["node", "server.js"]
