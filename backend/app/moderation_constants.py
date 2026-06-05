class ReviewSkipIds:
    VARIANTS = ("Debug", "Docs", "Locale", "Sources")

    def __init__(self) -> None:
        self._ids: set[str] = set()
        self._prefixes: tuple[str, ...] = ()

    def add(self, flatpak_id: str) -> None:
        self._ids.add(flatpak_id)

        for variant in self.VARIANTS:
            self._ids.add(f"{flatpak_id}.{variant}")

    def add_prefix(self, prefix: str) -> None:
        self._prefixes += (prefix,)

    def matches(self, flatpak_id: str) -> bool:
        return flatpak_id in self._ids or flatpak_id.startswith(self._prefixes)


_review_skip = ReviewSkipIds()

# Flathub

# Ships metainfo file that generates review requests between different
# branches
_review_skip.add("com.riverbankcomputing.PyQt.BaseApp")

# Used by infra and must not get caught by moderation
_review_skip.add("org.flatpak.Builder")

# FDSDK

# Both exact prefixes serve as public extension points as well so this
# cannot be a prefix match
_review_skip.add("org.freedesktop.Platform")
_review_skip.add("org.freedesktop.Sdk")

# Apps shipped along with FDSDK runtime
_review_skip.add("org.freedesktop.Platform.ClInfo")
_review_skip.add("org.freedesktop.Platform.codecs-extra")
_review_skip.add("org.freedesktop.Platform.GlxInfo")
_review_skip.add("org.freedesktop.Platform.VaInfo")
_review_skip.add("org.freedesktop.Platform.VdpauInfo")
_review_skip.add("org.freedesktop.Platform.VulkanInfo")

# Prefix is used by NVIDIA GL extension so this is an exact match
_review_skip.add("org.freedesktop.Platform.GL.default")
_review_skip.add("org.freedesktop.Platform.GL.Debug.default")

# GNOME runtime IDs

_review_skip.add("org.gnome.Platform")
_review_skip.add("org.gnome.Sdk")

# KDE runtime IDs

_review_skip.add("org.kde.Platform")
_review_skip.add("org.kde.Sdk")

# FDSDK runtime prefixes

_review_skip.add_prefix("org.freedesktop.Platform.codecs_extra.")
_review_skip.add_prefix("org.freedesktop.Platform.Compat.")
_review_skip.add_prefix("org.freedesktop.Platform.GL32.")

# Prefix match for Intel, nvidia variants and i386 variants of each
_review_skip.add_prefix("org.freedesktop.Platform.VAAPI.")

_review_skip.add_prefix("org.freedesktop.Sdk.Compat.")

# GNOME runtime prefixes

_review_skip.add_prefix("org.gnome.Sdk.Compat.")


def should_skip_review(flatpak_id: str) -> bool:
    return _review_skip.matches(flatpak_id)
