from fastapi import APIRouter, FastAPI, Response
from fastapi.responses import ORJSONResponse

from . import wallet, worker

router = APIRouter(prefix="/update", default_response_class=ORJSONResponse)


def register_to_app(app: FastAPI):
    app.include_router(router)


@router.post("", tags=["update"])
async def update():
    worker.update.send()
    worker.update_quality_moderation.send()


@router.post("/stats", tags=["update"])
async def update_stats():
    worker.update_stats.send()


@router.post("/process-pending-transfers", tags=["update"])
def process_transfers():
    """
    Process any pending transfers which may be in the system
    """
    wallet.Wallet().perform_pending_transfers()
    return Response(None, status_code=200)
