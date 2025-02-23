from fastapi import APIRouter, FastAPI, Query, Response
from fastapi.responses import ORJSONResponse

from .. import schemas, search

router = APIRouter(
    prefix="/collection",
    tags=["collection"],
    default_response_class=ORJSONResponse,
)


def register_to_app(app: FastAPI):
    app.include_router(router)


@router.get("/category")
def get_categories() -> list[str]:
    return [category.value for category in schemas.MainCategory]


@router.get("/category/{category}")
def get_category(
    category: schemas.MainCategory,
    exclude_subcategories: list[str] = Query(None),
    page: int | None = None,
    per_page: int | None = None,
    locale: str = "en",
    sort_by: schemas.SortBy | None = None,
    response: Response = Response(),
):
    if (page is None and per_page is not None) or (
        page is not None and per_page is None
    ):
        response.status_code = 400
        return response

    result = search.get_by_selected_categories(
        [category], exclude_subcategories, page, per_page, locale, sort_by
    )

    return result


@router.get("/category/{category}/subcategories")
def get_subcategory(
    category: schemas.MainCategory,
    subcategory: list[str] = Query(None),
    exclude_subcategories: list[str] = Query(None),
    page: int | None = None,
    per_page: int | None = None,
    locale: str = "en",
    sort_by: schemas.SortBy | None = None,
    response: Response = Response(),
):
    if (page is None and per_page is not None) or (
        page is not None and per_page is None
    ):
        response.status_code = 400
        return response

    if subcategory is None:
        response.status_code = 400
        return response

    result = search.get_by_selected_category_and_subcategory(
        category, subcategory, exclude_subcategories, page, per_page, locale, sort_by
    )

    return result


@router.get("/keyword")
def get_keyword(
    keyword: str,
    page: int | None = None,
    per_page: int | None = None,
    locale: str = "en",
    response: Response = Response(),
):
    if (page is None and per_page is not None) or (
        page is not None and per_page is None
    ):
        response.status_code = 400
        return response

    result = search.get_by_keyword(keyword, page, per_page, locale)

    return result


@router.get("/developer")
def get_developers(
    page: int | None = None,
    per_page: int | None = None,
    response: Response = Response(),
) -> dict[str, object]:
    if (page is None and per_page is not None) or (
        page is not None and per_page is None
    ):
        response.status_code = 400
        return response

    return search.get_developers(page, per_page)


@router.get("/developer/{developer:path}")
def get_developer(
    developer: str,
    page: int | None = None,
    per_page: int | None = None,
    locale: str = "en",
    response: Response = Response(),
):
    if (page is None and per_page is not None) or (
        page is not None and per_page is None
    ):
        response.status_code = 400
        return response

    result = search.get_by_developer(developer, page, per_page, locale)

    return result


@router.get("/recently-updated")
def get_recently_updated(
    page: int | None = None,
    per_page: int | None = None,
    locale: str = "en",
    response: Response = Response(),
):
    if (page is None and per_page is not None) or (
        page is not None and per_page is None
    ):
        response.status_code = 400
        return response

    result = search.get_by_updated_at(page, per_page, locale)

    return result


@router.get("/recently-added")
def get_recently_added(
    page: int | None = None,
    per_page: int | None = None,
    locale: str = "en",
    response: Response = Response(),
):
    if (page is None and per_page is not None) or (
        page is not None and per_page is None
    ):
        response.status_code = 400
        return response

    result = search.get_by_added_at(page, per_page, locale)

    return result


@router.get("/verified")
def get_verified(
    page: int | None = None,
    per_page: int | None = None,
    locale: str = "en",
    response: Response = Response(),
):
    if (page is None and per_page is not None) or (
        page is not None and per_page is None
    ):
        response.status_code = 400
        return response

    result = search.get_by_verified(page, per_page, locale)

    return result


@router.get("/mobile")
def get_mobile(
    page: int | None = None,
    per_page: int | None = None,
    locale: str = "en",
    response: Response = Response(),
):
    if (page is None and per_page is not None) or (
        page is not None and per_page is None
    ):
        response.status_code = 400
        return response

    result = search.get_by_mobile(page, per_page, locale)

    return result
