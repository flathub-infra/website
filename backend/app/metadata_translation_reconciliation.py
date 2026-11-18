"""Decide which saved edits can be written without replacing another translation."""

from collections import Counter
from dataclasses import dataclass

from .metadata_translations import MetadataDocument, TranslationUnit


@dataclass
class Reconciliation:
    apply: dict[str, str]  # Current document IDs, which may differ after a rebase.
    satisfied: set[str]  # Original IDs for recognizing edits accepted in review.
    retain: list[TranslationUnit]


def reconcile(
    original: MetadataDocument,
    current: MetadataDocument | None,
    changes: dict[str, str],
    *,
    expected: dict[str, str] | None = None,
) -> Reconciliation:
    """Compare each proposed text with the value seen at save time."""

    def identity(unit):
        return unit.field, unit.context, unit.source

    old = original.units()
    latest = current.units() if current is not None else []
    old_counts = Counter(map(identity, old))
    counts = Counter(map(identity, latest))
    by_identity = {identity(unit): unit for unit in latest}
    result = Reconciliation({}, set(), [])
    aligned = current is not None and (original.anchored_to or original) is (
        current.anchored_to or current
    )
    for unit in old:
        if unit.id not in changes:
            continue
        text = changes[unit.id]
        key = identity(unit)
        match = (
            current.nodes[unit.id].unit
            if aligned and current is not None
            else (by_identity[key] if old_counts[key] == counts[key] == 1 else None)
        )
        if match is None or identity(match) != key:
            result.retain.append(unit.model_copy(update={"translation": text}))
        elif match.translation == text:
            result.satisfied.add(unit.id)
        elif match.translation == (expected or {}).get(unit.id, unit.translation):
            result.apply[match.id] = text
        else:
            result.retain.append(unit.model_copy(update={"translation": text}))
    return result
