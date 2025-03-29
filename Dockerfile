# Stage 1: Build dependencies (if needed for complex builds, otherwise skip)
# FROM python:3.10-slim as builder
# WORKDIR /build
# COPY requirements.txt .
# RUN pip wheel --no-cache-dir --wheel-dir /wheels -r requirements.txt

# Stage 2: Final application image
FROM python:3.10-slim # Or 3.11 if preferred

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE 1
ENV PYTHONUNBUFFERED 1
# Set desired log level via environment variable (overrides config.py default if set)
ENV LOG_LEVEL="INFO"
# Set Python path (good practice)
ENV PYTHONPATH=/app

# Set work directory
WORKDIR /app

# Install system dependencies if needed (e.g., for certain libraries)
# RUN apt-get update && apt-get install -y --no-install-recommends some-package && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
# Copy only requirements first to leverage Docker cache
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt
    # If using builder stage:
    # RUN pip install --no-cache-dir /wheels/*

# Copy the application code AND the static files
COPY ./app /app/app
COPY ./static /app/static   # <-- Ensures static files are copied

# Expose the port the app runs on (default Uvicorn port)
EXPOSE 8000

# Define the command to run the application using Uvicorn
# Use 0.0.0.0 to listen on all network interfaces within the container
# Use --workers 1 for simplicity, adjust based on performance needs and testing
# Use --forwarded-allow-ips='*' if running behind a trusted reverse proxy
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]

# Optional Healthcheck for Docker Swarm/Kubernetes
# HEALTHCHECK --interval=15s --timeout=5s --start-period=30s --retries=3 \
#   CMD curl --fail http://localhost:8000/ || exit 1 # Update health check endpoint if / is UI