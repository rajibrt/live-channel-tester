FROM python:3.11-slim

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

COPY requirements.local-agent.txt ./
RUN pip install --no-cache-dir -r requirements.local-agent.txt

COPY checker.py env_loader.py local_agent.py supabase_publisher.py ./

EXPOSE 8787

CMD ["uvicorn", "local_agent:app", "--host", "0.0.0.0", "--port", "8787"]
