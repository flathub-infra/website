from fastapi import APIRouter, FastAPI, Response
from fastapi.responses import ORJSONResponse

from . import cache, wallet, worker

router = APIRouter(prefix="/update", default_response_class=ORJSONResponse)


def register_to_app(app: FastAPI):
    app.include_router(router)


@router.post(
    "",
    tags=["update"],
    responses={
        200: {"description": "Update completed successfully"},
        500: {"description": "Internal server error"},
    },
)
async def update():
    worker.update.send()
    worker.update_quality_moderation.send()
    cache.mark_stale_by_pattern("cache:endpoint:*")


@router.post(
    "/stats",
    tags=["update"],
    responses={
        200: {"description": "Stats updated successfully"},
        500: {"description": "Internal server error"},
    },
)
async def update_stats():
    worker.update_stats.send()


@router.post(
    "/process-pending-transfers",
    tags=["update"],
    responses={
        200: {"description": "Pending transfers processed successfully"},
        500: {"description": "Internal server error"},
    },
)
def process_transfers():
    """
    Process any pending transfers which may be in the system
    """
    wallet.Wallet().perform_pending_transfers()
    return Response(None, status_code=200)
