from enum import StrEnum


class ModerationRequestType(StrEnum):
    APPDATA = "appdata"
    SUMMARY = "summary"
    MANIFEST = "manifest"
