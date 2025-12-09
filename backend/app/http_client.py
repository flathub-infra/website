from contextlib import contextmanager

import httpx

DEFAULT_TIMEOUT = httpx.Timeout(
    connect=5.0,
    read=30.0,
    write=10.0,
    pool=5.0,
)

LONG_READ_TIMEOUT = httpx.Timeout(
    connect=5.0,
    read=120.0,
    write=10.0,
    pool=5.0,
)


def get(url: str, **kwargs) -> httpx.Response:
    kwargs.setdefault("timeout", DEFAULT_TIMEOUT)
    return httpx.get(url, **kwargs)


def post(url: str, **kwargs) -> httpx.Response:
    kwargs.setdefault("timeout", DEFAULT_TIMEOUT)
    return httpx.post(url, **kwargs)


@contextmanager
def stream(method: str, url: str, **kwargs):
    kwargs.setdefault("timeout", LONG_READ_TIMEOUT)
    with httpx.stream(method, url, **kwargs) as response:
        yield response
