FROM debian:testing as builder

RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        python3 python3-dev python-is-python3 python3-venv build-essential libcairo2-dev libgirepository1.0-dev \
        gir1.2-ostree-1.0 gir1.2-appstream-1.0 flatpak

RUN python -m venv /venv && \
    /venv/bin/python -m pip install -U pip 'micropipenv[toml]' && \
    ln -s /venv/bin/pip /usr/local/bin/pip

COPY pyproject.toml poetry.lock /
RUN /venv/bin/micropipenv install

FROM debian:testing-slim
ARG SENTRY_RELEASE
ENV PATH="/venv/bin:$PATH"

EXPOSE 8000

RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        python3 python-is-python3 python3-venv ca-certificates libcairo2 gir1.2-ostree-1.0 gir1.2-appstream-1.0 flatpak && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

RUN flatpak --user remote-add flathub https://flathub.org/repo/flathub.flatpakrepo && \
    flatpak --user remote-add flathub-beta https://flathub.org/beta-repo/flathub-beta.flatpakrepo

COPY --from=builder /venv /venv
ADD . /app
WORKDIR /app

ENV SENTRY_RELEASE="$SENTRY_RELEASE"

CMD ["/app/docker-entrypoint.sh"]
