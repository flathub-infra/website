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


# https://specifications.freedesktop.org/menu-spec/latest/additional-category-registry.html

SUBCATEGORY_MAP = {
    "AudioVideo": [
        "AudioVideoEditing",
        "DiscBurning",
        "Midi",
        "Mixer",
        "Music",
        "Player",
        "Recorder",
        "Sequencer",
        "Tuner",
        "TV",
    ],
    "Development": [
        "Building",
        "Database",
        "Debugger",
        "GUIDesigner",
        "IDE",
        "Profiling",
        "ProjectManagement",
        "RevisionControl",
        "Translation",
        "WebDevelopment",
    ],
    "Education": [
        "ArtificialIntelligence",
        "Art",
        "Astronomy",
        "Biology",
        "Chemistry",
        "ComputerScience",
        "Construction",
        "DataVisualization",
        "Economy",
        "Electricity",
        "Geography",
        "Geology",
        "Geoscience",
        "History",
        "Humanities",
        "ImageProcessing",
        "Languages",
        "Literature",
        "Maps",
        "Math",
        "MedicalSoftware",
        "NumericalAnalysis",
        "ParallelComputing",
        "Physics",
        "Robotics",
        "Spirituality",
        "Sports",
    ],
    "Game": [
        "ActionGame",
        "AdventureGame",
        "ArcadeGame",
        "BlocksGame",
        "BoardGame",
        "CardGame",
        "Emulator",
        "KidsGame",
        "LogicGame",
        "RolePlaying",
        "Shooter",
        "Simulation",
        "SportsGame",
        "StrategyGame",
    ],
    "Graphics": [
        "2DGraphics",
        "3DGraphics",
        "OCR",
        "Photography",
        "Publishing",
        "RasterGraphics",
        "Scanning",
        "VectorGraphics",
        "Viewer",
    ],
    "Network": [
        "Chat",
        "Email",
        "Feed",
        "FileTransfer",
        "HamRadio",
        "InstantMessaging",
        "IRCClient",
        "Monitor",
        "News",
        "P2P",
        "RemoteAccess",
        "Telephony",
        "VideoConference",
        "WebBrowser",
        "WebDevelopment",
    ],
    "Office": [
        "Calendar",
        "Chart",
        "ContactManagement",
        "Database",
        "Dictionary",
        "Email",
        "Finance",
        "Presentation",
        "ProjectManagement",
        "Publishing",
        "Spreadsheet",
        "Viewer",
        "WordProcessor",
    ],
    "Science": [
        "ArtificialIntelligence",
        "Art",
        "Astronomy",
        "Biology",
        "Chemistry",
        "ComputerScience",
        "Construction",
        "DataVisualization",
        "Economy",
        "Electricity",
        "Geography",
        "Geology",
        "Geoscience",
        "History",
        "Humanities",
        "ImageProcessing",
        "Languages",
        "Literature",
        "Maps",
        "Math",
        "MedicalSoftware",
        "NumericalAnalysis",
        "ParallelComputing",
        "Physics",
        "Robotics",
        "Spirituality",
        "Sports",
    ],
    "System": [
        "Emulator",
        "FileManager",
        "FileTools",
        "Filesystem",
        "Monitor",
        "Security",
        "TerminalEmulator",
    ],
    "Utility": [
        "Accessibility",
        "Archiving",
        "Calculator",
        "Clock",
        "Compression",
        "FileTools",
        "TelephonyTools",
        "TextEditor",
        "TextTools",
    ],
}


def get_subcategories(category: MainCategory) -> list[str]:
    return SUBCATEGORY_MAP.get(category.name, [])
