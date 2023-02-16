from enum import Enum

# https://specifications.freedesktop.org/menu-spec/latest/apa.html


class MainCategory(str, Enum):
    AudioVideo = "AudioVideo"
    Development = "Development"
    Education = "Education"
    Game = "Game"
    Graphics = "Graphics"
    Network = "Network"
    Office = "Office"
    Science = "Science"
    System = "System"
    Utility = "Utility"


def get_main_categories():
    return [category.value for category in MainCategory]
