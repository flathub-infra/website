"""
Pydantic models for API responses.

These models define the structure of JSON responses returned by the API,
enabling FastAPI to generate proper OpenAPI specifications and TypeScript types.
"""

import datetime
from typing import Annotated, Literal

from pydantic import BaseModel, Field

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
    version: str
    date: datetime.date | None = None
    type: Literal["stable", "development", "snapshot"] | None = None
    urgency: Literal["low", "medium", "high", "critical"] | None = None
    description: str | None = None
    url: str | None = None
    date_eol: datetime.date | None = None


class ContentRating(BaseModel):
    """Content rating information."""

    type: str | None = None
    violence_cartoon: Severity | None = None
    violence_fantasy: Severity | None = None
    violence_realistic: Severity | None = None
    violence_bloodshed: Severity | None = None
    violence_sexual: Severity | None = None
    violence_desecration: Severity | None = None
    violence_slavery: Severity | None = None
    violence_worship: Severity | None = None
    drugs_alcohol: Severity | None = None
    drugs_narcotics: Severity | None = None
    drugs_tobacco: Severity | None = None
    sex_nudity: Severity | None = None
    sex_themes: Severity | None = None
    sex_homosexuality: Severity | None = None
    sex_prostitution: Severity | None = None
    sex_adultery: Severity | None = None
    sex_appearance: Severity | None = None
    language_profanity: Severity | None = None
    language_humor: Severity | None = None
    language_discrimination: Severity | None = None
    social_chat: Severity | None = None
    social_info: Severity | None = None
    social_audio: Severity | None = None
    social_location: Severity | None = None
    social_contacts: Severity | None = None
    money_purchasing: Severity | None = None
    money_gambling: Severity | None = None


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

    class Config:
        populate_by_name = True


class Icon(BaseModel):
    """Icon information with different sizes."""

    url: str | None = None
    width: int | None = None
    height: int | None = None
    scale: int | None = None
    type: Literal["remote", "cached"] | None = None


class Metadata(BaseModel):
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

    class Config:
        populate_by_name = True


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
    content_rating: ContentRating | None = None
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


class AddonAppstream(BaseModel):
    """
    Addon Appstream metadata
    """

    type: Literal["addon"]
    id: str
    name: str
    summary: str
    releases: list[Release] | None = None
    content_rating: ContentRating | None = None
    urls: Urls | None = None
    icon: str | None = None
    icons: list[Icon] | None = None
    developer_name: str | None = None
    project_license: str | None = None
    extends: str
    bundle: Bundle
    metadata: Metadata | None = None
    isMobileFriendly: bool | None = None
    is_free_license: bool


class RuntimeAppstream(BaseModel):
    """
    Runtime Appstream metadata
    """

    type: Literal["runtime"]
    id: str
    name: str
    summary: str
    description: str
    releases: list[Release] | None = None
    urls: Urls
    icon: str | None = None
    icons: list[Icon] | None = None
    developer_name: str | None = None
    project_license: str
    bundle: Bundle
    metadata: Metadata | None = None
    isMobileFriendly: bool | None = None
    is_free_license: bool


class GenericAppstream(BaseModel):
    """
    Generic Appstream metadata
    """

    type: Literal["generic"]
    id: str
    name: str
    summary: str
    releases: list[Release] | None = None
    urls: Urls
    icon: str | None = None
    icons: list[Icon] | None = None
    project_license: str
    bundle: Bundle
    isMobileFriendly: bool | None = None
    is_free_license: bool


class LocalizationAppstream(BaseModel):
    """
    Localization Appstream metadata
    """

    type: Literal["localization"]
    id: str
    name: str
    summary: str
    urls: Urls
    icon: str | None = None
    icons: list[Icon] | None = None
    project_license: str
    bundle: Bundle
    metadata: Metadata | None = None
    isMobileFriendly: bool | None = None
    is_free_license: bool


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
