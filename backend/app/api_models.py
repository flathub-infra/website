"""
Pydantic models for API responses.

These models define the structure of JSON responses returned by the API,
enabling FastAPI to generate proper OpenAPI specifications and TypeScript types.
"""

import datetime
from typing import Annotated, Any, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.models import ConnectedAccountProvider

# Appstream Models

Severity = Literal["none", "mild", "moderate", "intense"]


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

    timestamp: str | None = None
    version: str | None = None
    date: datetime.date | None = None
    type: Literal["stable", "development", "snapshot"] = "stable"
    urgency: Literal["low", "medium", "high", "critical"] | None = None
    description: str | None = None
    url: str | None = None
    date_eol: datetime.date | None = None

    @field_validator("type", mode="before")
    @classmethod
    def default_type_to_stable(cls, v):
        """Per the AppStream spec, releases without an explicit type default to 'stable'.

        Legacy cached data may contain null values for the type field.
        """
        if v is None:
            return "stable"
        return v


class Urls(BaseModel):
    """Various URLs related to the app."""

    bugtracker: str | None = None
    homepage: str | None = None
    help: str | None = None
    donation: str | None = None
    translate: str | None = None
    faq: str | None = None
    contact: str | None = None
    vcs_browser: str | None = None
    contribute: str | None = None


class Translation(BaseModel):
    """Translation information."""

    value: str | None = None
    type: str | None = None


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

    model_config = ConfigDict(populate_by_name=True)

    verified: bool = Field(False, alias="flathub::verification::verified")
    method: Literal["manual", "website", "login_provider", "none"] | None = Field(
        None, alias="flathub::verification::method"
    )
    login_name: str | None = Field(None, alias="flathub::verification::login_name")
    login_provider: ConnectedAccountProvider | None = Field(
        None, alias="flathub::verification::login_provider"
    )
    login_is_organization: bool | None = Field(
        None, alias="flathub::verification::login_is_organization"
    )
    website: str | None = Field(None, alias="flathub::verification::website")
    timestamp: str | None = Field(None, alias="flathub::verification::timestamp")


class Icon(BaseModel):
    """Icon information with different sizes."""

    url: str | None = None
    width: int | None = None
    height: int | None = None
    scale: int | None = None
    type: Literal["remote", "cached"] | None = None


class Metadata(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    flathub_manifest: str | None = Field(None, alias="flathub::manifest")
    flathub_verification_verified: bool | None = Field(
        None, alias="flathub::verification::verified"
    )
    flathub_verification_method: (
        Literal["manual", "website", "login_provider", "none"] | None
    ) = Field(None, alias="flathub::verification::method")
    flathub_verification_login_name: str | None = Field(
        None, alias="flathub::verification::login_name"
    )
    flathub_verification_login_provider: ConnectedAccountProvider | None = Field(
        None, alias="flathub::verification::login_provider"
    )
    flathub_verification_website: str | None = Field(
        None, alias="flathub::verification::website"
    )
    flathub_verification_timestamp: str | None = Field(
        None, alias="flathub::verification::timestamp"
    )
    flathub_verification_login_is_organization: bool | None = Field(
        None, alias="flathub::verification::login_is_organization"
    )


class DesktopAppstream(BaseModel):
    """
    Desktop application Appstream metadata, matching frontend DesktopAppstream type.
    """

    type: Literal["desktop-application", "console-application", "desktop"]
    id: str
    name: str
    summary: str
    description: str
    developer_name: str | None = None
    icon: str | None = None
    icons: list[Icon] | None = None
    screenshots: list[Screenshot] | None = None
    releases: list[Release]
    content_rating_details: dict[str, Any] | None = None
    urls: Urls | None = None
    categories: list[str] | None = None
    kudos: list[str] | None = None
    keywords: list[str] | None = None
    mimetypes: list[str] | None = None
    project_license: str | None = None
    provides: list[Provides | str] | None = None
    launchable: Launchable | None = None
    bundle: Bundle
    translation: Translation | None = None
    metadata: Metadata | None = None
    is_free_license: bool
    isMobileFriendly: bool | None = None
    branding: list[Branding] | None = None
    is_eol: bool = False


class AddonAppstream(BaseModel):
    """
    Addon Appstream metadata
    """

    type: Literal["addon"]
    id: str
    name: str
    summary: str
    releases: list[Release] | None = None
    content_rating_details: dict[str, Any] | None = None
    urls: Urls | None = None
    categories: list[str] | None = None
    icon: str | None = None
    icons: list[Icon] | None = None
    developer_name: str | None = None
    project_license: str | None = None
    extends: str
    bundle: Bundle
    metadata: Metadata | None = None
    isMobileFriendly: bool | None = None
    is_free_license: bool
    is_eol: bool = False


class RuntimeAppstream(BaseModel):
    """
    Runtime Appstream metadata
    """

    type: Literal["runtime"]
    id: str
    name: str
    summary: str
    description: str | None = None
    releases: list[Release] | None = None
    content_rating_details: dict[str, Any] | None = None
    urls: Urls
    categories: list[str] | None = None
    icon: str | None = None
    icons: list[Icon] | None = None
    developer_name: str | None = None
    project_license: str | None = None
    bundle: Bundle
    metadata: Metadata | None = None
    isMobileFriendly: bool | None = None
    is_free_license: bool
    is_eol: bool = False


class GenericAppstream(BaseModel):
    """
    Generic Appstream metadata
    """

    type: Literal["generic"]
    id: str
    name: str
    summary: str
    releases: list[Release] | None = None
    content_rating_details: dict[str, Any] | None = None
    urls: Urls
    categories: list[str] | None = None
    icon: str | None = None
    icons: list[Icon] | None = None
    developer_name: str | None = None
    project_license: str | None = None
    bundle: Bundle
    metadata: Metadata | None = None
    isMobileFriendly: bool | None = None
    is_free_license: bool
    is_eol: bool = False


class LocalizationAppstream(BaseModel):
    """
    Localization Appstream metadata
    """

    type: Literal["localization"]
    id: str
    name: str
    summary: str
    releases: list[Release] | None = None
    content_rating_details: dict[str, Any] | None = None
    urls: Urls
    categories: list[str] | None = None
    icon: str | None = None
    icons: list[Icon] | None = None
    developer_name: str | None = None
    project_license: str | None = None
    bundle: Bundle
    metadata: Metadata | None = None
    isMobileFriendly: bool | None = None
    is_free_license: bool
    is_eol: bool = False


Appstream = Annotated[
    DesktopAppstream
    | AddonAppstream
    | LocalizationAppstream
    | GenericAppstream
    | RuntimeAppstream,
    Field(discriminator="type"),
]


# Summary Models
class SummaryPermissions(BaseModel):
    """Permissions required by the application."""

    model_config = ConfigDict(populate_by_name=True)

    shared: list[str] | None = None
    sockets: list[str] | None = None
    devices: list[str] | None = None
    filesystems: list[str] | None = None
    session_bus: dict[str, list[str]] | None = Field(None, alias="session-bus")


class SummaryExtension(BaseModel):
    """Extension information."""

    model_config = ConfigDict(extra="allow")

    directory: str | None = None
    autodelete: str | None = None
    noAutodownload: str | None = None
    version: str | None = None
    versions: str | None = None


class SummaryExtraData(BaseModel):
    """Extra data information."""

    name: str
    checksum: str
    size: str
    uri: str


class SummaryMetadata(BaseModel):
    """Metadata from the Flatpak summary."""

    model_config = ConfigDict(extra="allow")

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
    runtimeInstalledSize: int | None = None
    runtimeName: str | None = None


class SummaryResponse(BaseModel):
    """
    Summary information response for an application.

    This model represents the summary data returned by the /summary/{app_id} endpoint,
    containing information about app size, architectures, and metadata.
    """

    model_config = ConfigDict(extra="allow")

    arches: list[str]
    branch: str | None = None
    timestamp: int
    download_size: int
    installed_size: int
    metadata: SummaryMetadata | None = None
