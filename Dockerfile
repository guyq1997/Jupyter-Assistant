# Build stage for Frontend
FROM node:18-alpine AS frontend-builder

# Set working directory
WORKDIR /app/frontend

# Copy package files
COPY frontend/package*.json ./

# Install dependencies
RUN npm install

# Copy frontend source code
COPY frontend/ ./

# Build frontend
RUN npm run build

# Build stage for Backend
FROM python:3.12-slim AS backend

# Set working directory
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements and install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
RUN python -m nltk.downloader all
# Copy backend source code
COPY src/ /app/src/

# Copy run script
COPY run.py .

# Copy built frontend files
COPY --from=frontend-builder /app/frontend/build /app/frontend/build

# Set environment variables
ENV PYTHONUNBUFFERED=1
ENV PYTHONPATH=/app

# Create necessary directories
RUN mkdir -p /app/uploads

# Expose port
EXPOSE 8765

# Start the application using run.py
CMD ["python", "run.py"] 