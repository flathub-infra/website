FROM python:3.11 as builder

RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        build-essential libcairo2-dev libgirepository1.0-dev \
        gir1.2-ostree-1.0 gir1.2-appstream-1.0 flatpak

RUN curl -sSL https://install.python-poetry.org | /usr/local/bin/python - && \
    python -m venv /venv && \
    /venv/bin/python -m pip install -U pip

COPY pyproject.toml poetry.lock /

RUN $HOME/.local/bin/poetry export -o requirements.txt && \
    /venv/bin/pip install -r requirements.txt

FROM python:3.11-slim
ARG SENTRY_RELEASE
ENV PATH="/venv/bin:$PATH"

EXPOSE 8000

RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        libcairo2 gir1.2-ostree-1.0 gir1.2-appstream-1.0 flatpak && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

RUN flatpak --user remote-add flathub https://flathub.org/repo/flathub.flatpakrepo && \
    flatpak --user remote-add flathub-beta https://flathub.org/beta-repo/flathub-beta.flatpakrepo

COPY --from=builder /venv /venv
ADD . /app
WORKDIR /app

ENV SENTRY_RELEASE="$SENTRY_RELEASE"

CMD ["/app/docker-entrypoint.sh"]
