# Stage 1: Build
FROM node:20-alpine AS builder

WORKDIR /app

# Kopier package filer
COPY package*.json ./

# Installer dependencies
RUN npm ci

# Kopier source kode
COPY . .

# Byg produktions-version
RUN npm run build

# Stage 2: Production med nginx
FROM nginx:alpine

# Kopier nginx config
COPY nginx.conf /etc/nginx/nginx.conf

# Kopier byggede filer fra builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Expose port
EXPOSE 80

# Start nginx
CMD ["nginx", "-g", "daemon off;"]
