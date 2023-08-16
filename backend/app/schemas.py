from enum import StrEnum, auto

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


def get_main_categories():
    return [category.value for category in MainCategory]
