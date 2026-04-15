"""Pure functions for automated quality moderation checks."""

import re


def summary_doesnt_start_with_article(summary: str) -> bool:
    return bool(summary) and not bool(re.match(r"^(A|An|The)\s", summary))


def summary_doesnt_repeat_app_name(name: str, summary: str) -> bool:
    return (
        bool(name)
        and bool(summary)
        and not bool(re.search(r"\b" + re.escape(name) + r"\b", summary))
    )
