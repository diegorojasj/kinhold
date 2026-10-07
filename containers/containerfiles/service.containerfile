# One image recipe for every backend service: build with --build-arg SERVICE=<household|shopping|chores|money|bills>.
# Build context: services/
FROM docker.io/library/python:3.14-slim
ARG SERVICE
ENV SERVICE=${SERVICE} \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1
WORKDIR /app
COPY requirements.default /tmp/requirements.default
RUN pip install --no-cache-dir -r /tmp/requirements.default
COPY common /app/common
COPY ${SERVICE}-service /app
RUN useradd --system --no-create-home kinhold
USER kinhold
EXPOSE 8000
# Each service owns its Postgres schema, so it applies its own migrations before starting.
CMD ["sh", "-c", "python manage.py migrate --noinput && exec uvicorn config.asgi:application --host 0.0.0.0 --port 8000 --workers ${WORKERS:-2}"]
