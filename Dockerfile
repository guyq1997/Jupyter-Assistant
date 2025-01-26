FROM python:3.12-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first to leverage Docker cache
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy the source code
COPY src/ /app/src/


# Make sure the src directory is in Python path
ENV PYTHONPATH=/app

# Create necessary directories
RUN mkdir -p /app/uploads

# Set environment variables
ENV PYTHONUNBUFFERED=1

# Expose the port for network communication
EXPOSE 8765

# Command to run the agent as a module
CMD ["python", "-m", "src.agents.agent"] 