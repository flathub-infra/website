from enum import StrEnum, auto, Enum

# https://specifications.freedesktop.org/menu-spec/latest/apa.html


class MainCategory(StrEnum):
    AudioVideo = auto()
    Development = auto()
    Education = auto()
    Game = auto()
    Graphics = auto()
    Network = auto()
    Office = auto()
    Science = auto()
    System = auto()
    Utility = auto()

    @classmethod
    def _missing_(cls, value):
        value = value.lower()
        for member in cls:
            if member == value:
                return member
        return None


class FilterType(str, Enum):
    MAIN_CATEGORIES = "main_categories"
    SUB_CATEGORIES = "sub_categories"
    DEVELOPER_NAME = "developer_name"
    VERIFICATION_VERIFIED = "verification_verified"
    IS_FREE_LICENSE = "is_free_license"
    RUNTIME = "runtime"
    TYPE = "type"
    ARCHES = "arches"
    ICON = "icon"
    KEYWORDS = "keywords"
    IS_MOBILE_FRIENDLY = "isMobileFriendly"


def get_main_categories():
    return [category.value for category in MainCategory]


class SortBy(StrEnum):
    Trending = auto()
    InstallsLastMonth = "installs_last_month"  # installs_last_month

    @classmethod
    def _missing_(cls, value):
        value = value.lower()
        for member in cls:
            if member == value:
                return member
        return None


class FilterType(str, Enum):
    MAIN_CATEGORIES = "main_categories"
    SUB_CATEGORIES = "sub_categories"
    DEVELOPER_NAME = "developer_name"
    VERIFICATION_VERIFIED = "verification_verified"
    IS_FREE_LICENSE = "is_free_license"
    RUNTIME = "runtime"
    TYPE = "type"
    ARCHES = "arches"
    ICON = "icon"
    KEYWORDS = "keywords"
    IS_MOBILE_FRIENDLY = "isMobileFriendly"
