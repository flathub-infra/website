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


class Type(str, Enum):
    All = "all"
    Addon = "addon"
    ConsoleApplication = "console-application"
    Desktop = "desktop"
    Generic = "generic"
    Inputmethod = "inputmethod"
    Runtime = "runtime"
