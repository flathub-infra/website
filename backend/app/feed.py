from fastapi import APIRouter, FastAPI, Response
from fastapi.responses import ORJSONResponse

from . import feeds

router = APIRouter(prefix="/feed", default_response_class=ORJSONResponse)


def register_to_app(app: FastAPI):
    app.include_router(router)


@router.get("/recently-updated", tags=["feed"])
def get_recently_updated_apps_feed():
    return Response(
        content=feeds.get_recently_updated_apps_feed(), media_type="application/rss+xml"
    )


@router.get("/new", tags=["feed"])
def get_new_apps_feed():
    return Response(content=feeds.get_new_apps_feed(), media_type="application/rss+xml")
