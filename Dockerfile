# Stage 1: Build Frontend
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build

# Stage 2: Production Backend & Static Serving
FROM node:20-alpine
WORKDIR /app

# Set production environment
ENV NODE_ENV=production
ENV PORT=5000

# Install backend dependencies
WORKDIR /app/backend
COPY backend/package*.json ./
RUN npm install --only=production

# Copy backend source code
COPY backend/ ./

# Copy built frontend into dist folder
COPY --from=frontend-builder /app/frontend/dist /app/frontend/dist

# Create uploads and data directories with permissions
RUN mkdir -p /app/backend/uploads /app/backend/data

EXPOSE 5000

CMD ["node", "src/server.js"]
