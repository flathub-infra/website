FROM ghcr.io/flathub-infra/backend-builder-base:latest AS builder

COPY pyproject.toml poetry.lock /

RUN /root/.local/bin/poetry export -f requirements.txt --output requirements.txt && \
    python -m venv /venv && \
    /venv/bin/python -m pip install --no-cache-dir -r requirements.txt

FROM ghcr.io/flathub-infra/backend-base:latest
ARG SENTRY_RELEASE
ENV PATH="/venv/bin:$PATH"

EXPOSE 8000

COPY --from=builder /venv /venv
COPY . /app
WORKDIR /app

ENV SENTRY_RELEASE="$SENTRY_RELEASE"

CMD ["/app/docker-entrypoint.sh"]
