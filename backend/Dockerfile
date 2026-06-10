# ==========================================
# HexaAttender Backend Production Dockerfile
# ==========================================

FROM python:3.11-slim AS builder

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# Install system dependencies required for building C extensions
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    cmake \
    libpq-dev \
    libgl1 \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

# Install python dependencies in a virtual environment
RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Final minimal runner stage
FROM python:3.11-slim AS runner

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV PATH="/opt/venv/bin:$PATH"

# Install runtime dependencies (e.g., PostgreSQL client libraries)
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq-dev \
    libgl1 \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

# Copy python virtual environment dependencies from builder
COPY --from=builder /opt/venv /opt/venv

# Copy backend application source
COPY . .

# Create a non-privileged system user for secure container execution
RUN useradd -U django \
    && chown -R django:django /app \
    && mkdir -p /app/staticfiles /app/media \
    && chown -R django:django /app/staticfiles /app/media

USER django

EXPOSE 8000

# Start Gunicorn production WSGI server
CMD ["gunicorn", "config.wsgi:application", "--bind", "0.0.0.0:8000", "--workers", "3", "--timeout", "120"]
