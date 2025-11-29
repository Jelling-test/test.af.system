# Simpel Dockerfile - kun nginx med færdige filer
FROM nginx:alpine

# Kopier nginx config
COPY nginx.conf /etc/nginx/nginx.conf

# Kopier færdigbyggede filer
COPY dist /usr/share/nginx/html

# Expose port
EXPOSE 80

# Start nginx
CMD ["nginx", "-g", "daemon off;"]
