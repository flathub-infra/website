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


@router.get(
    "/category",
    responses={
        200: {"description": "List of all available categories"},
    },
)
def get_categories() -> list[str]:
    return [category.value for category in schemas.MainCategory]


@router.get(
    "/category/{category}",
    responses={
        200: {"description": "Apps in the specified category"},
        400: {"description": "Invalid pagination parameters"},
    },
)
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


@router.get(
    "/category/{category}/subcategories",
    responses={
        200: {"description": "Apps in the specified subcategories"},
        400: {"description": "Invalid pagination parameters"},
    },
)
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


@router.get(
    "/keyword",
    responses={
        200: {"description": "Apps matching the keyword"},
        400: {"description": "Invalid pagination parameters"},
    },
)
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


@router.get(
    "/developer",
    responses={
        200: {"description": "List of developers"},
        400: {"description": "Invalid pagination parameters"},
    },
)
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


@router.get(
    "/developer/{developer:path}",
    responses={
        200: {"description": "Apps by the specified developer"},
        400: {"description": "Invalid pagination parameters"},
    },
)
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


@router.get(
    "/recently-updated",
    responses={
        200: {"description": "Recently updated apps"},
        400: {"description": "Invalid pagination parameters"},
    },
)
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


@router.get(
    "/recently-added",
    responses={
        200: {"description": "Recently added apps"},
        400: {"description": "Invalid pagination parameters"},
    },
)
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


@router.get(
    "/verified",
    responses={
        200: {"description": "Verified apps"},
        400: {"description": "Invalid pagination parameters"},
    },
)
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


@router.get(
    "/mobile",
    responses={
        200: {"description": "Mobile-friendly apps"},
        400: {"description": "Invalid pagination parameters"},
    },
)
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


@router.get(
    "/popular",
    responses={
        200: {"description": "Popular apps (last month)"},
        400: {"description": "Invalid pagination parameters"},
    },
)
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


@router.get(
    "/trending",
    responses={
        200: {"description": "Trending apps (last two weeks)"},
        400: {"description": "Invalid pagination parameters"},
    },
)
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
