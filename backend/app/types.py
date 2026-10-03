from enum import StrEnum


class ModerationRequestType(StrEnum):
    APPDATA = "appdata"
    SUMMARY = "summary"
    MANIFEST = "manifest"


class ModerationOriginKind(StrEnum):
    MANIFEST_SOURCE = "manifest-source"
    EXTRA_DATA = "extra-data"
