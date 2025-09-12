from fastapi import APIRouter, FastAPI, HTTPException, Query, Response
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


@router.get("/subcategories")
def get_subcategories() -> dict[str, list[str]]:
    return search.get_subcategories()


@router.get("/category/{category}")
def get_category(
    category: schemas.MainCategory,
    exclude_subcategories: list[str] = Query(None),
    page: int | None = None,
    per_page: int | None = None,
    locale: str = "en",
    sort_by: schemas.SortBy | None = None,
    response: Response = Response(),
) -> search.MeilisearchResponse[search.AppsIndex]:
    if (page is None and per_page is not None) or (
        page is not None and per_page is None
    ):
        raise HTTPException(
            status_code=400,
        )

    result = search.get_by_selected_categories(
        [category], exclude_subcategories, page, per_page, locale, sort_by
    )

    return result


@router.get("/category/{category}/subcategories")
def get_subcategory(
    category: schemas.MainCategory,
    subcategory: list[str] = Query(),
    exclude_subcategories: list[str] = Query(None),
    page: int | None = None,
    per_page: int | None = None,
    locale: str = "en",
    sort_by: schemas.SortBy | None = None,
    response: Response = Response(),
) -> search.MeilisearchResponse[search.AppsIndex]:
    if (page is None and per_page is not None) or (
        page is not None and per_page is None
    ):
        raise HTTPException(
            status_code=400,
        )

    if subcategory is None:
        raise HTTPException(
            status_code=400,
        )

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
) -> search.MeilisearchResponse[search.AppsIndex]:
    if (page is None and per_page is not None) or (
        page is not None and per_page is None
    ):
        raise HTTPException(
            status_code=400,
        )

    result = search.get_by_keyword(keyword, page, per_page, locale)

    return result


@router.get("/developer")
def get_developers(
    page: int | None = None,
    per_page: int | None = None,
    response: Response = Response(),
) -> search.DevelopersResponse:
    if (page is None and per_page is not None) or (
        page is not None and per_page is None
    ):
        raise HTTPException(
            status_code=400,
        )

    return search.get_developers(page, per_page)


@router.get("/developer/{developer:path}")
def get_developer(
    developer: str,
    page: int | None = None,
    per_page: int | None = None,
    locale: str = "en",
    response: Response = Response(),
) -> search.MeilisearchResponse[search.AppsIndex]:
    if (page is None and per_page is not None) or (
        page is not None and per_page is None
    ):
        raise HTTPException(
            status_code=400,
        )

    result = search.get_by_developer(developer, page, per_page, locale)

    return result


@router.get("/recently-updated")
def get_recently_updated(
    page: int | None = None,
    per_page: int | None = None,
    locale: str = "en",
    response: Response = Response(),
) -> search.MeilisearchResponse[search.AppsIndex]:
    if (page is None and per_page is not None) or (
        page is not None and per_page is None
    ):
        raise HTTPException(
            status_code=400,
        )

    result = search.get_by_updated_at(page, per_page, locale)

    return result


@router.get("/recently-added")
def get_recently_added(
    page: int | None = None,
    per_page: int | None = None,
    locale: str = "en",
    response: Response = Response(),
) -> search.MeilisearchResponse[search.AppsIndex]:
    if (page is None and per_page is not None) or (
        page is not None and per_page is None
    ):
        raise HTTPException(
            status_code=400,
        )

    result = search.get_by_added_at(page, per_page, locale)

    return result


@router.get("/verified")
def get_verified(
    page: int | None = None,
    per_page: int | None = None,
    locale: str = "en",
    response: Response = Response(),
) -> search.MeilisearchResponse[search.AppsIndex]:
    if (page is None and per_page is not None) or (
        page is not None and per_page is None
    ):
        raise HTTPException(
            status_code=400,
        )

    result = search.get_by_verified(page, per_page, locale)

    return result


@router.get("/mobile")
def get_mobile(
    page: int | None = None,
    per_page: int | None = None,
    locale: str = "en",
    response: Response = Response(),
) -> search.MeilisearchResponse[search.AppsIndex]:
    if (page is None and per_page is not None) or (
        page is not None and per_page is None
    ):
        raise HTTPException(
            status_code=400,
        )

    result = search.get_by_mobile(page, per_page, locale)

    return result


@router.get("/popular")
def get_popular_last_month(
    page: int | None = None,
    per_page: int | None = None,
    locale: str = "en",
    response: Response = Response(),
) -> search.MeilisearchResponse[search.AppsIndex]:
    if (page is None and per_page is not None) or (
        page is not None and per_page is None
    ):
        raise HTTPException(
            status_code=400,
        )

    result = search.get_by_installs_last_month(page, per_page, locale)

    return result


@router.get("/trending")
def get_trending_last_two_weeks(
    page: int | None = None,
    per_page: int | None = None,
    locale: str = "en",
    response: Response = Response(),
) -> search.MeilisearchResponse[search.AppsIndex]:
    if (page is None and per_page is not None) or (
        page is not None and per_page is None
    ):
        raise HTTPException(
            status_code=400,
        )

    result = search.get_by_trending(page, per_page, locale)

    return result
