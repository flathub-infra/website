"""Extend login identity without reissuing a snapshot of an in-flight login flow."""

import hashlib
import secrets

from fastapi import Request, Response
from itsdangerous import BadSignature, URLSafeTimedSerializer
from starlette.middleware.sessions import Session
from starlette.requests import HTTPConnection
from starlette.types import ASGIApp, Message, Receive, Scope, Send

from .login_info import SESSION_IDENTITY_FIELDS

SESSION_MAX_AGE = 24 * 60 * 60
_IDENTITY_PREFIX = "__Host-flathub-browsing-"
_GENERATION_COOKIE = "__Host-flathub-session-generation"


def browsing_lookup(request: Request) -> None:
    request.state.browsing_lookup = True


def _identity_fields(session: dict[str, object]) -> dict[str, object]:
    return {key: session[key] for key in SESSION_IDENTITY_FIELDS if key in session}


def _generation_key(generation: str | None) -> str:
    return hashlib.sha256((generation or "").encode()).hexdigest()


class BrowsingSessionMiddleware:
    """Runs inside SessionMiddleware so auth-state writes take precedence."""

    def __init__(self, app: ASGIApp, secret_key: str):
        self.app = app
        self.signer = URLSafeTimedSerializer(secret_key, salt="flathub-browsing")

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        connection = HTTPConnection(scope)
        session: Session = scope["session"]
        generation = connection.cookies.get(_GENERATION_COOKIE)
        identity_cookie = _IDENTITY_PREFIX + _generation_key(generation)
        if not session and not generation:
            # Active browsing can outlast the generation marker. Older generations'
            # signed renewals have already expired by the time the marker expires.
            remaining = [
                name for name in connection.cookies if name.startswith(_IDENTITY_PREFIX)
            ]
            if len(remaining) == 1:
                identity_cookie = remaining[0]
        cookie = connection.cookies.get(identity_cookie)
        if not session and cookie:
            try:
                identity = self.signer.loads(cookie, max_age=SESSION_MAX_AGE)
            except BadSignature:
                pass
            else:
                if not generation or identity["generation"] == generation:
                    generation = identity["generation"]
                    # Construct a clean session, like Starlette decoding its cookie.
                    scope["session"] = session = Session(_identity_fields(identity))

        # A delayed rejection must only invalidate the generation it inspected.
        rejected_cookie = "__Host-flathub-rejected-" + _generation_key(generation)
        if rejected_cookie in connection.cookies:
            scope["session"] = session = Session()
        previous_user = session.get("user-id")

        def update_cookies(message: Message) -> None:
            identity_removed = previous_user is not None and "user-id" not in session
            cookies = Response()
            if getattr(connection.state, "browsing_lookup", False):
                # A browsing response must never rewrite the main session cookie.
                session.modified = False
                if identity_removed:
                    cookies.set_cookie(
                        rejected_cookie,
                        "1",
                        max_age=2 * SESSION_MAX_AGE,
                        secure=True,
                        httponly=True,
                    )
                elif message["status"] == 200 and "user-id" in session:
                    identity = _identity_fields(session)
                    identity["generation"] = generation
                    cookies.set_cookie(
                        identity_cookie,
                        self.signer.dumps(identity),
                        max_age=SESSION_MAX_AGE,
                        secure=True,
                        httponly=True,
                    )
                else:
                    return
            elif session.modified or getattr(
                connection.state, "invalidate_browsing_session", False
            ):
                if cookie:
                    cookies.delete_cookie(identity_cookie, secure=True, httponly=True)
                # Outlive older browsing responses still in flight.
                cookies.set_cookie(
                    _GENERATION_COOKIE,
                    secrets.token_urlsafe(24),
                    max_age=2 * SESSION_MAX_AGE,
                    secure=True,
                    httponly=True,
                )
            else:
                return
            message["headers"].extend(
                header for header in cookies.raw_headers if header[0] == b"set-cookie"
            )

        async def send_response(message: Message) -> None:
            if message["type"] == "http.response.start":
                update_cookies(message)
            await send(message)

        await self.app(scope, receive, send_response)
