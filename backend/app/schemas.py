from enum import Enum

# https://specifications.freedesktop.org/menu-spec/latest/apa.html


class Category(str, Enum):
    AudioVideo = "AudioVideo"
    Audio = "Audio"
    Video = "Video"
    Development = "Development"
    Education = "Education"
    Game = "Game"
    Graphics = "Graphics"
    Network = "Network"
    Office = "Office"
    Science = "Science"
    Settings = "Settings"
    System = "System"
    Utility = "Utility"
