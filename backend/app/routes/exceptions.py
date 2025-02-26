from fastapi import APIRouter, FastAPI, Path, Response
from fastapi.responses import ORJSONResponse

from .. import db

router = APIRouter(
    prefix="/exceptions",
    tags=["app"],
    default_response_class=ORJSONResponse,
)


def register_to_app(app: FastAPI):
    app.include_router(router)


@router.get("/", tags=["app"])
def get_exceptions():
    return db.get_json_key("exc")


@router.get("/{app_id}", tags=["app"])
def get_exceptions_for_app(app_id: str, response: Response):
    if exc := db.get_json_key(f"exc:{app_id}"):
        return exc

    response.status_code = 404
    return None 