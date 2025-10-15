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
    response_model=list[str],
    responses={
        200: {"description": "List of all available categories"},
    },
)
def get_categories() -> list[str]:
    """Get a list of all available main categories for filtering applications."""
    return [category.value for category in schemas.MainCategory]


@router.get(
    "/category/{category}",
    response_model=search.MeilisearchResponse[search.AppsIndex],
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
    """
    Get applications in a specific main category.

    Supports pagination, subcategory exclusion, and custom sorting.
    """
    if (page is None and per_page is not None) or (
        page is not None and per_page is None
    ):
        raise HTTPException(
            status_code=400,
        )

    if page is not None and page < 0:
        raise HTTPException(
            status_code=400,
        )

    result = search.get_by_selected_categories(
        [category], exclude_subcategories, page, per_page, locale, sort_by
    )

    return result


@router.get(
    "/category/{category}/subcategories",
    response_model=search.MeilisearchResponse[search.AppsIndex],
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
    """
    Get applications in specific subcategories within a main category.

    Filters by one or more subcategories (e.g., "ActionGame", "ArcadeGame")
    with optional exclusions and sorting.
    """
    if (page is None and per_page is not None) or (
        page is not None and per_page is None
    ):
        raise HTTPException(
            status_code=400,
        )

    if page is not None and page < 0:
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
    response_model=search.MeilisearchResponse[search.AppsIndex],
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
    """
    Search for applications by keyword.

    Returns apps that have the specified keyword in their metadata.
    """
    if (page is None and per_page is not None) or (
        page is not None and per_page is None
    ):
        raise HTTPException(
            status_code=400,
        )

    if page is not None and page < 0:
        raise HTTPException(
            status_code=400,
        )

    result = search.get_by_keyword(keyword, page, per_page, locale)

    return result


@router.get(
    "/developer",
    response_model=search.DevelopersResponse,
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
    """
    Get a paginated list of all developers/publishers on Flathub.

    Returns developer names that can be used to filter applications.
    """
    if (page is None and per_page is not None) or (
        page is not None and per_page is None
    ):
        raise HTTPException(
            status_code=400,
        )

    if page is not None and page < 0:
        raise HTTPException(
            status_code=400,
        )

    return search.get_developers(page, per_page)


@router.get(
    "/developer/{developer:path}",
    response_model=search.MeilisearchResponse[search.AppsIndex],
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
    """
    Get all applications published by a specific developer.

    The developer parameter should match the developer_name field from appstream data.
    """
    if (page is None and per_page is not None) or (
        page is not None and per_page is None
    ):
        raise HTTPException(
            status_code=400,
        )

    if page is not None and page < 0:
        raise HTTPException(
            status_code=400,
        )

    result = search.get_by_developer(developer, page, per_page, locale)

    return result


@router.get(
    "/recently-updated",
    response_model=search.MeilisearchResponse[search.AppsIndex],
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
    """
    Get applications that have been recently updated.

    Sorted by the most recent release timestamp.
    """
    if (page is None and per_page is not None) or (
        page is not None and per_page is None
    ):
        raise HTTPException(
            status_code=400,
        )

    if page is not None and page < 0:
        raise HTTPException(
            status_code=400,
        )

    result = search.get_by_updated_at(page, per_page, locale)

    return result


@router.get(
    "/recently-added",
    response_model=search.MeilisearchResponse[search.AppsIndex],
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
    """
    Get applications that have been recently added to Flathub.

    Sorted by the date the app was first published.
    """
    if (page is None and per_page is not None) or (
        page is not None and per_page is None
    ):
        raise HTTPException(
            status_code=400,
        )

    if page is not None and page < 0:
        raise HTTPException(
            status_code=400,
        )

    result = search.get_by_added_at(page, per_page, locale)

    return result


@router.get(
    "/verified",
    response_model=search.MeilisearchResponse[search.AppsIndex],
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
    """
    Get applications that have been verified by Flathub.

    Verified apps have proven ownership/authenticity through one of the
    verification methods (website, GitHub org, GitLab group, etc.).
    """
    if (page is None and per_page is not None) or (
        page is not None and per_page is None
    ):
        raise HTTPException(
            status_code=400,
        )

    if page is not None and page < 0:
        raise HTTPException(
            status_code=400,
        )

    result = search.get_by_verified(page, per_page, locale)

    return result


@router.get(
    "/mobile",
    response_model=search.MeilisearchResponse[search.AppsIndex],
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
    """
    Get applications that are mobile-friendly.

    These apps are designed to work well on mobile devices and
    have the isMobileFriendly flag set in their metadata.
    """
    if (page is None and per_page is not None) or (
        page is not None and per_page is None
    ):
        raise HTTPException(
            status_code=400,
        )

    if page is not None and page < 0:
        raise HTTPException(
            status_code=400,
        )

    result = search.get_by_mobile(page, per_page, locale)

    return result


@router.get(
    "/popular",
    response_model=search.MeilisearchResponse[search.AppsIndex],
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
    """
    Get the most popular applications based on installs in the last month.

    Sorted by the number of installations in the previous 30 days.
    """
    if (page is None and per_page is not None) or (
        page is not None and per_page is None
    ):
        raise HTTPException(
            status_code=400,
        )

    if page is not None and page < 0:
        raise HTTPException(
            status_code=400,
        )

    result = search.get_by_installs_last_month(page, per_page, locale)

    return result


@router.get(
    "/trending",
    response_model=search.MeilisearchResponse[search.AppsIndex],
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
    """
    Get trending applications based on recent growth in installs.

    Uses a trending score calculated from install growth over the last two weeks,
    highlighting apps that are gaining popularity.
    """
    if (page is None and per_page is not None) or (
        page is not None and per_page is None
    ):
        raise HTTPException(
            status_code=400,
        )

    if page is not None and page < 0:
        raise HTTPException(
            status_code=400,
        )

    result = search.get_by_trending(page, per_page, locale)

    return result
