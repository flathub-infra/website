FROM python:3.10 as builder

RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        build-essential libcairo2-dev libgirepository1.0-dev \
        gir1.2-ostree-1.0 flatpak

RUN curl -sSL https://raw.githubusercontent.com/python-poetry/poetry/master/get-poetry.py | /usr/local/bin/python - && \
    python -m venv /venv && \
    /venv/bin/python -m pip install -U pip

COPY pyproject.toml poetry.lock /

RUN $HOME/.poetry/bin/poetry export -o requirements.txt && \
    /venv/bin/pip install -r requirements.txt

FROM python:3.10-slim
ENV PATH="/venv/bin:$PATH"

EXPOSE 8000

RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        libcairo2 gir1.2-ostree-1.0 flatpak && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

RUN flatpak --user remote-add flathub https://flathub.org/repo/flathub.flatpakrepo && \
    flatpak --user remote-add flathub-beta https://flathub.org/beta-repo/flathub-beta.flatpakrepo

COPY --from=builder /venv /venv
ADD . /app
WORKDIR /app

CMD ["/app/docker-entrypoint.sh"]
