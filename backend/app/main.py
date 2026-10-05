from contextlib import asynccontextmanager

import sentry_sdk
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from granian.utils.proxies import wrap_asgi_with_proxy_headers
from sentry_sdk.integrations.fastapi import FastApiIntegration
from sentry_sdk.integrations.redis import RedisIntegration
from sentry_sdk.integrations.sqlalchemy import SqlalchemyIntegration
from sentry_sdk.integrations.starlette import StarletteIntegration

from . import (
    cache,
    config,
    database,
    emails,
    logins,
    update,
    users,
    vending,
    verification,
    wallet,
)
from .moderation import permission_assessment_api
from .moderation import review as moderation
from .routes import (
    app_picks,
    apps,
    collection,
    exceptions,
    favorites,
    feed,
    invites,
    oidc,
    oidc_admin,
    purchases,
    quality_moderation,
    runtimes,
    stats,
    upload_tokens,
    year_in_review,
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
        before_send=emails.sentry_before_send,
        before_send_transaction=emails.sentry_before_send_transaction,
        before_breadcrumb=emails.sentry_before_breadcrumb,
    )


@asynccontextmanager
async def lifespan(app: FastAPI):
    await database.get_redis()
    yield
    await database.close_redis()


router = FastAPI(
    title=config.settings.app_name,
    root_path="" if config.settings.env == "development" else "/api/v2",
    lifespan=lifespan,
)

origins = config.settings.cors_origins.split(" ")
router.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["Retry-After"],
)

apps.register_to_app(router)
update.register_to_app(router)

emails.register_to_app(router)
logins.register_to_app(router)
moderation.register_to_app(router)
permission_assessment_api.register_to_app(router)
wallet.register_to_app(router)
vending.register_to_app(router)

verification.register_to_app(router)
purchases.register_to_app(router)
invites.register_to_app(router)

app_picks.register_to_app(router)
collection.register_to_app(router)
feed.register_to_app(router)
quality_moderation.register_to_app(router)
upload_tokens.register_to_app(router)
runtimes.register_to_app(router)
exceptions.register_to_app(router)
oidc.register_to_app(router)
oidc_admin.register_to_app(router)

users.register_to_app(router)
favorites.register_to_app(router)
stats.register_to_app(router)
year_in_review.register_to_app(router)

app = wrap_asgi_with_proxy_headers(
    cache.CacheControlMiddleware(router),
    trusted_hosts=[
        "10.0.0.0/8",
        "23.235.32.0/20",
        "43.249.72.0/22",
        "103.244.50.0/24",
        "103.245.222.0/23",
        "103.245.224.0/24",
        "104.156.80.0/20",
        "140.248.64.0/18",
        "140.248.128.0/17",
        "146.75.0.0/17",
        "151.101.0.0/16",
        "157.52.64.0/18",
        "167.82.0.0/17",
        "167.82.128.0/20",
        "167.82.160.0/20",
        "167.82.224.0/20",
        "172.111.64.0/18",
        "185.31.16.0/22",
        "199.27.72.0/21",
        "199.232.0.0/16",
        "2a04:4e40::/32",
        "2a04:4e42::/32",
    ],
)


@router.get(
    "/status",
    status_code=200,
    tags=["healthcheck"],
    responses={
        200: {"description": "Service is healthy"},
    },
)
def healthcheck():
    return {"status": "OK"}
