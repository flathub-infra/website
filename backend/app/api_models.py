"""
Pydantic models for API responses.

These models define the structure of JSON responses returned by the API,
enabling FastAPI to generate proper OpenAPI specifications and TypeScript types.
"""

from typing import Any, Literal

from pydantic import BaseModel, Field

# Appstream Models


class ScreenshotSize(BaseModel):
    """A single size variant of a screenshot."""

    width: str
    height: str
    scale: str = "1x"
    src: str


class Screenshot(BaseModel):
    """A screenshot with multiple size variants."""

    sizes: list[ScreenshotSize]
    caption: str | None = None
    default: bool | None = None


class Release(BaseModel):
    """A release/version entry."""

    timestamp: str
    version: str | None = None
    description: str | None = None
    url: str | None = None


class ContentRating(BaseModel):
    """Content rating information."""

    type: str

    class Config:
        # Allow extra fields for rating attributes like violence-cartoon, etc.
        extra = "allow"


class Urls(BaseModel):
    """Various URLs related to the app."""

    bugtracker: str | None = None
    homepage: str | None = None
    help: str | None = None
    donation: str | None = None
    translate: str | None = None
    faq: str | None = None
    contact: str | None = None
    vcs_browser: str | None = Field(None, alias="vcs-browser")


class Translation(BaseModel):
    """Translation information."""

    value: str | None = None
    type: str


class Launchable(BaseModel):
    """Launchable information."""

    value: str
    type: str


class Bundle(BaseModel):
    """Bundle information."""

    value: str
    type: str
    runtime: str | None = None
    sdk: str | None = None


class Branding(BaseModel):
    """Branding color information."""

    value: str
    scheme_preference: Literal["light", "dark"] | None = None
    type: Literal["primary"]


class Provides(BaseModel):
    """Provides information - what the app provides to the system."""

    value: str
    type: str


class VerificationMetadata(BaseModel):
    """Verification metadata embedded in appstream."""

    verified: bool = Field(False, alias="flathub::verification::verified")
    method: str | None = Field(None, alias="flathub::verification::method")
    login_name: str | None = Field(None, alias="flathub::verification::login_name")
    login_provider: str | None = Field(
        None, alias="flathub::verification::login_provider"
    )
    login_is_organization: bool | None = Field(
        None, alias="flathub::verification::login_is_organization"
    )
    website: str | None = Field(None, alias="flathub::verification::website")
    timestamp: str | None = Field(None, alias="flathub::verification::timestamp")

    class Config:
        populate_by_name = True


class Icon(BaseModel):
    """Icon information with different sizes."""

    url: str | None = None
    width: int | None = None
    height: int | None = None
    scale: int | None = None
    type: Literal["remote", "cached"] | None = None


class AppstreamResponse(BaseModel):
    """
    Full appstream metadata response for an application.

    This model represents the complete appstream data that is returned
    by the /appstream/{app_id} endpoint, including all metadata, screenshots,
    releases, and other information about a Flatpak application.
    """

    type: str
    id: str
    name: str
    summary: str
    description: str | None = None
    developer_name: str | None = None
    icon: str | None = None
    icons: list[Icon] | None = None
    screenshots: list[Screenshot] | None = None
    releases: list[Release] | None = None
    content_rating: ContentRating | None = None
    urls: Urls | None = None
    categories: list[str] | None = None
    kudos: list[str] | None = None
    keywords: list[str] | None = None
    mimetypes: list[str] | None = None
    project_license: str | None = None
    provides: list[str | Provides] | None = None
    launchable: Launchable | None = None
    bundle: Bundle | None = None
    translation: Translation | None = None
    metadata: dict[str, Any] | None = None
    is_free_license: bool = False
    isMobileFriendly: bool = False
    branding: list[Branding] | None = None

    class Config:
        # Allow extra fields that may be added in the future
        extra = "allow"


# Summary Models


class SummaryPermissions(BaseModel):
    """Permissions required by the application."""

    shared: list[str] | None = None
    sockets: list[str] | None = None
    devices: list[str] | None = None
    filesystems: list[str] | None = None
    session_bus: dict[str, list[str]] | None = Field(None, alias="session-bus")

    class Config:
        populate_by_name = True


class SummaryExtension(BaseModel):
    """Extension information."""

    directory: str | None = None
    autodelete: str | None = None
    noAutodownload: str | None = None
    version: str | None = None
    versions: str | None = None

    class Config:
        # Allow any additional fields
        extra = "allow"


class SummaryExtraData(BaseModel):
    """Extra data information."""

    name: str
    checksum: str
    size: str
    uri: str


class SummaryMetadata(BaseModel):
    """Metadata from the Flatpak summary."""

    name: str
    runtime: str
    sdk: str | None = None
    tags: list[str] | None = None
    command: str | None = None
    permissions: SummaryPermissions | None = None
    extensions: dict[str, SummaryExtension] | None = None
    builtExtensions: list[str] | None = None
    extraData: SummaryExtraData | None = None
    runtimeIsEol: bool = False

    class Config:
        # Allow extra fields that may be added
        extra = "allow"


class SummaryResponse(BaseModel):
    """
    Summary information response for an application.

    This model represents the summary data returned by the /summary/{app_id} endpoint,
    containing information about app size, architectures, and metadata.
    """

    arches: list[str]
    branch: str | None = None
    timestamp: int
    download_size: int
    installed_size: int
    metadata: SummaryMetadata | None = None

    class Config:
        # Allow extra fields for forward compatibility
        extra = "allow"
