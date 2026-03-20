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
    libgirepository-2.0-0 gir1.2-ostree-1.0 gir1.2-appstream-1.0 libjemalloc2 && \
    # Install appstream and extract its .mo translation files manually,
    # bypassing the slim image's /usr/share/locale/* dpkg exclusion filter
    apt-get download appstream && \
    dpkg -x appstream_*.deb /tmp/appstream-deb && \
    find /tmp/appstream-deb/usr/share/locale -name 'appstream.mo' \
        -exec sh -c 'mkdir -p "$(dirname "/usr/share/locale/${1#/tmp/appstream-deb/usr/share/locale/}")" && cp "$1" "/usr/share/locale/${1#/tmp/appstream-deb/usr/share/locale/}"' _ {} \; && \
    rm -rf /tmp/appstream-deb appstream_*.deb && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

COPY --from=builder /.venv /.venv
COPY . /app
WORKDIR /app

ENV PATH="/.venv/bin:$PATH" \
    SENTRY_RELEASE="$SENTRY_RELEASE"

EXPOSE 8000

CMD ["/app/docker-entrypoint.sh"]
