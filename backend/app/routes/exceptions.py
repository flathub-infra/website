from fastapi import APIRouter, Depends, FastAPI, Response
from fastapi.responses import ORJSONResponse

from .. import db
from ..database import get_db
from ..models import Exceptions

router = APIRouter(
    prefix="/exceptions",
    tags=["app"],
    default_response_class=ORJSONResponse,
)


def register_to_app(app: FastAPI):
    app.include_router(router)


@router.get("/", tags=["app"])
def get_exceptions(db_session=Depends(get_db)):
    return Exceptions.get_all_exceptions(db_session)


@router.get("/{app_id}", tags=["app"])
def get_exceptions_for_app(app_id: str, response: Response, db_session=Depends(get_db)):
    if exc := Exceptions.get_exception(db_session, app_id):
        return exc

    response.status_code = 404
    return None 