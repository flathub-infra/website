from enum import Enum

# https://specifications.freedesktop.org/menu-spec/latest/apa.html


class Category(str, Enum):
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
