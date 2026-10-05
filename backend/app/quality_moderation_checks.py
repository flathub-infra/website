"""Pure functions for automated quality moderation checks."""

import re


def summary_doesnt_start_with_article(summary: str) -> bool:
    normalized_summary = summary.strip()
    return bool(normalized_summary) and not bool(
        re.match(r"^(A|An|The)\s", normalized_summary, re.IGNORECASE)
    )


def summary_doesnt_repeat_app_name(name: str, summary: str) -> bool:
    return (
        bool(name)
        and bool(summary)
        and not bool(re.search(r"\b" + re.escape(name) + r"\b", summary))
    )
