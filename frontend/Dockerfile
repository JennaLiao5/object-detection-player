# Build stage
FROM node:20 AS builder

# Set working directory
WORKDIR /app

# Copy package files and install dependencies
COPY package.json package-lock.json* ./
RUN npm install

# Copy remaining code and build
COPY . .
RUN npm run build


# Production stage
FROM nginx:alpine

# Remove default Nginx static pages
RUN rm -rf /usr/share/nginx/html/*

# Copy built static files from builder stage
COPY --from=builder /app/build /usr/share/nginx/html

# Default Nginx port 80
EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]