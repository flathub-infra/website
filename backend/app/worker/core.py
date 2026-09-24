from ..config import settings
from ..dramatiq_broker import broker
from ..emails import sentry_before_breadcrumb, sentry_before_send

__all__ = ["broker"]

if settings.sentry_dsn:
    import sentry_sdk
    from sentry_sdk.integrations.dramatiq import DramatiqIntegration

    sentry_sdk.init(
        dsn=settings.sentry_dsn,
        environment="production",
        integrations=[DramatiqIntegration()],
        before_send=sentry_before_send,
        before_breadcrumb=sentry_before_breadcrumb,
    )
