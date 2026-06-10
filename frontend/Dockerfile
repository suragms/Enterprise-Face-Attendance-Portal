# ===========================================
# HexaAttender Frontend Production Dockerfile
# ===========================================

# Stage 1: Build the optimized static assets
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

# Run production compilation and TypeScript strict validations
RUN npm run build

# Stage 2: Serve the compiled static assets using Nginx Alpine
FROM nginx:1.25-alpine AS runner

# Remove default Nginx welcome pages
RUN rm -rf /usr/share/nginx/html/*

# Copy compiled static assets from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Expose port 80 internally
EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
