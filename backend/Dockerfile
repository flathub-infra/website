FROM debian:testing AS builder

COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    python3 python3-dev python3-pip python-is-python3 python3-venv \
    build-essential libpq-dev libcairo2-dev libgirepository-2.0-dev \
    gir1.2-ostree-1.0 gir1.2-appstream-1.0

COPY pyproject.toml uv.lock /
RUN uv venv && uv sync

FROM debian:testing-slim
ARG SENTRY_RELEASE

RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    python3 python-is-python3 python3-venv ca-certificates libcairo2 libpq5 \
    libgirepository-2.0-0 gir1.2-ostree-1.0 gir1.2-appstream-1.0 && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

COPY --from=builder /.venv /.venv
COPY . /app
WORKDIR /app

ENV PATH="/.venv/bin:$PATH" \
    SENTRY_RELEASE="$SENTRY_RELEASE"

EXPOSE 8000

CMD ["/app/docker-entrypoint.sh"]
