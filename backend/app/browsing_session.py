"""Extend login identity without reissuing a snapshot of an in-flight login flow."""

import hashlib
import secrets

from fastapi import Request, Response
from itsdangerous import BadSignature, URLSafeTimedSerializer
from starlette.middleware.sessions import Session
from starlette.requests import HTTPConnection
from starlette.types import ASGIApp, Message, Receive, Scope, Send

SESSION_MAX_AGE = 24 * 60 * 60
_IDENTITY_COOKIE = "__Host-flathub-browsing"
_GENERATION_COOKIE = "__Host-flathub-session-generation"
_IDENTITY_FIELDS = ("user-id", "auth-method", "passkey-id", "auth-time")


def browsing_lookup(request: Request) -> None:
    request.state.browsing_lookup = True


def _identity_fields(session: dict) -> dict:
    return {key: session[key] for key in _IDENTITY_FIELDS if key in session}


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
        cookie = connection.cookies.get(_IDENTITY_COOKIE)
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
        generation_hash = hashlib.sha256((generation or "").encode()).hexdigest()
        rejected_cookie = f"__Host-flathub-rejected-{generation_hash}"
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
                        _IDENTITY_COOKIE,
                        self.signer.dumps(identity),
                        max_age=SESSION_MAX_AGE,
                        secure=True,
                        httponly=True,
                    )
                else:
                    return
            elif session.modified:
                if cookie:
                    cookies.delete_cookie(_IDENTITY_COOKIE, secure=True, httponly=True)
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
