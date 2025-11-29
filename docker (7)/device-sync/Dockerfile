FROM python:3.11-slim

WORKDIR /app

# Dependencies
RUN pip install --no-cache-dir \
    supabase==2.9.0 \
    paho-mqtt==1.6.1 \
    httpx==0.27.2

# App
COPY device_sync.py .

CMD ["python", "-u", "device_sync.py"]
