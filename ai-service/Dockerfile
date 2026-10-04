# =======================================================
# Dockerfile for Confidence AI Backend on Hugging Face Spaces
# =======================================================

FROM python:3.10-slim

# Prevent Python from writing .pyc and enable unbuffered logging
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    HOME=/home/user \
    PATH=/home/user/.local/bin:$PATH \
    API_PORT=7860 \
    API_HOST=0.0.0.0

# Install Linux system dependencies:
# - ffmpeg: required by MoviePy and Whisper audio extraction
# - libgl1 & libglib2.0-0: required by OpenCV headless
# - curl: for healthchecks
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    libgl1 \
    libglib2.0-0 \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Hugging Face runs containers with UID 1000 ("user")
RUN useradd -m -u 1000 user
WORKDIR /app

# Install Python requirements
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Pre-download the Whisper base model so cold-start requests don't delay
RUN python -c "import whisper; whisper.load_model('base')"

# Copy application source files
COPY . .

# Ensure storage directories exist and grant permissions to user 1000
RUN mkdir -p uploads logs reports temp && \
    chown -R user:user /app /home/user

# Switch to non-root user
USER user

# Hugging Face Spaces exposes port 7860
EXPOSE 7860

# Launch FastAPI via uvicorn
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "7860"]
