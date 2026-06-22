from ..config import settings
from ..dramatiq_broker import broker as broker

if settings.sentry_dsn:
    import sentry_sdk
    from sentry_sdk.integrations.dramatiq import DramatiqIntegration

    sentry_sdk.init(
        dsn=settings.sentry_dsn,
        environment="production",
        integrations=[DramatiqIntegration()],
    )
