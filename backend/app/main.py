import sentry_sdk
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import ORJSONResponse
from sentry_sdk.integrations.fastapi import FastApiIntegration
from sentry_sdk.integrations.redis import RedisIntegration
from sentry_sdk.integrations.sqlalchemy import SqlalchemyIntegration
from sentry_sdk.integrations.starlette import StarletteIntegration

from . import (
    app,
    config,
    db,
    emails,
    logins,
    moderation,
    purchases,
    update,
    users,
    vending,
    verification,
    wallet,
)
from .routes import (
    app_picks,
    compat,
    favorites,
    feed,
    invites,
    quality_moderation,
    upload_tokens,
)

if config.settings.sentry_dsn:
    sentry_sdk.init(
        dsn=config.settings.sentry_dsn,
        traces_sample_rate=0.1,
        profiles_sample_rate=0.1,
        environment="production",
        integrations=[
            StarletteIntegration(),
            FastApiIntegration(),
            SqlalchemyIntegration(),
            RedisIntegration(),
        ],
    )

router = FastAPI(
    title=config.settings.app_name,
    default_response_class=ORJSONResponse,
    root_path="" if config.settings.env == "development" else "/api/v2",
)

origins = config.settings.cors_origins.split(" ")
router.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.register_to_app(router)
update.register_to_app(router)

emails.register_to_app(router)
logins.register_to_app(router)
moderation.register_to_app(router)
wallet.register_to_app(router)
vending.register_to_app(router)

verification.register_to_app(router)
purchases.register_to_app(router)
invites.register_to_app(router)

app_picks.register_to_app(router)
compat.register_to_app(router)
feed.register_to_app(router)
quality_moderation.register_to_app(router)
upload_tokens.register_to_app(router)

users.register_to_app(router)
favorites.register_to_app(router)


@router.on_event("startup")
def startup_event():
    db.wait_for_redis()


@router.get("/status", status_code=200, tags=["healthcheck"])
def healthcheck():
    return {"status": "OK"}
