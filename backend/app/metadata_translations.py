"""Read and edit translations in recipe-owned AppStream metainfo."""

import copy
import re
from collections import defaultdict
from dataclasses import dataclass
from io import BytesIO
from xml.sax.saxutils import escape

from lxml import etree
from pydantic import BaseModel

LANG = "{http://www.w3.org/XML/1998/namespace}lang"
MAX_XML_BYTES = 1_000_000
LOCALE_PATTERN = r"^[a-z]{2,3}(?:[-_][A-Za-z0-9]{2,8})*(?:@[a-z]+)?$"
INVALID_XML_CHARACTERS = re.compile(
    r"[^\x09\x0a\x0d\x20-\ud7ff\ue000-\ufffd\U00010000-\U0010ffff]"
)
TEXT_FIELDS = {
    "name",
    "summary",
    "name_variant_suffix",
    "developer_name",
}
QUEUE_FIELDS = {"summary", "description", "keywords", "caption"}


class MetadataError(ValueError):
    pass


class TranslationUnit(BaseModel):
    id: str
    field: str
    context: str
    source: str
    translation: str
    markup: bool = False


class SharedTranslationUnit(TranslationUnit):
    version: str
    last_editor_id: int | None = None


def normalize_locale(locale: str) -> str:
    if not re.fullmatch(LOCALE_PATTERN, locale):
        raise MetadataError("invalid_locale")
    language, separator, modifier = locale.partition("@")
    parts = language.replace("-", "_").split("_")
    for index in range(1, len(parts)):
        part = parts[index]
        if len(part) == 2 and part.isalpha():
            parts[index] = part.upper()
        elif len(part) == 4 and part.isalpha():
            parts[index] = part.title()
        else:
            parts[index] = part.lower()
    return "_".join(parts) + separator + modifier


def _locale_key(locale: str) -> str:
    try:
        return normalize_locale(locale)
    except MetadataError:
        return locale


def _language(node) -> str | None:
    for ancestor in (node, *node.iterancestors()):
        if value := ancestor.get(LANG):
            return value.replace("-", "_")
    return None


def _translatable(node) -> bool:
    return not any(
        ancestor.get("translate") == "no" for ancestor in (node, *node.iterancestors())
    )


def _inner_xml(node) -> str:
    return escape(node.text or "") + "".join(
        etree.tostring(child, encoding="unicode") for child in node
    )


def _value(node, field: str, markup: bool) -> str:
    if node is None:
        return ""
    if field == "keywords":
        return "\n".join(child.text or "" for child in node.findall("keyword"))
    return _inner_xml(node).strip() if markup else (node.text or "").strip()


def _sibling_translations(parent):
    sources = defaultdict(list)
    localized = defaultdict(list)
    matches = defaultdict(dict)
    for node in parent:
        if lang := node.get(LANG):
            previous = sources[node.tag]
            localized[node.tag, _locale_key(lang)].append(
                (previous[-1] if previous else None, node)
            )
        else:
            sources[node.tag].append(node)
    for (tag, locale), entries in localized.items():
        complete = len(entries) == len(sources[tag])
        for index, (previous, translated) in enumerate(entries):
            source = sources[tag][index] if complete else previous
            if source is not None:
                matches[source][locale] = (
                    translated if locale not in matches[source] else None
                )
    return matches


@dataclass
class UnitNode:
    unit: TranslationUnit
    source: etree._Element
    translated: etree._Element | None


class MetadataDocument:
    def __init__(self, content: bytes, app_id: str, locale: str | None):
        self.anchored_to: MetadataDocument | None = None
        self.app_id = app_id
        self.locale = normalize_locale(locale) if locale is not None else None
        self.content = content
        if len(content) > MAX_XML_BYTES:
            raise MetadataError("metadata_too_large")
        try:
            self.tree = etree.parse(
                BytesIO(content),
                etree.XMLParser(resolve_entities=False, no_network=True),
            )
        except etree.XMLSyntaxError as error:
            raise MetadataError("invalid_metadata") from error
        root = self.tree.getroot()
        if self.tree.docinfo.doctype or root.tag != "component":
            raise MetadataError("unsupported_metadata")
        if root.findtext("id") != app_id:
            raise MetadataError("wrong_component")
        self.source_locale = (root.get(LANG) or "en").replace("-", "_")
        if self.locale == self.source_locale or (
            self.source_locale == "en" and self.locale == "en_US"
        ):
            raise MetadataError("source_locale")
        # A root xml:lang also sets the language of unmarked children.
        if root.get(LANG):
            raise MetadataError("unsupported_metadata")
        if root.xpath(
            ".//description[@xml:lang] | .//ul[@xml:lang] | .//ol[@xml:lang]"
        ):
            raise MetadataError("unsupported_metadata")
        self.license = (root.findtext("metadata_license") or "").strip()
        self.nodes: dict[str, UnitNode] = {}
        self.siblings = {}
        for node in root.iter():
            if (
                not isinstance(node.tag, str)
                or _language(node)
                or not _translatable(node)
            ):
                continue
            parent = node.getparent()
            if parent is None:
                continue
            field = None
            context = ""
            markup = False
            if parent is root and node.tag in TEXT_FIELDS:
                field = node.tag
            elif parent.tag == "developer" and node.tag == "name":
                field = "developer_name"
            elif node.tag == "caption" and parent.tag == "screenshot":
                field = "caption"
                context = str(list(parent.getparent()).index(parent) + 1)
            elif node.tag == "keywords" and parent is root:
                if any(child.get(LANG) for child in node):
                    raise MetadataError("unsupported_metadata")
                if any(not _translatable(child) for child in node):
                    continue
                field = "keywords"
            elif node.tag == "name" and parent.tag == "agreement_section":
                field = "agreement"
                context = parent.get("type", "")
            elif node.tag in {"p", "li", "heading"}:
                description = next(
                    (a for a in node.iterancestors() if a.tag == "description"), None
                )
                if description is None:
                    continue
                owner = description.getparent()
                if owner is root:
                    field = "description"
                elif owner.tag == "release":
                    field = "release"
                    context = owner.get("version", "")
                elif owner.tag == "agreement_section":
                    field = "agreement"
                    context = owner.get("type", "")
                markup = True
            if field is None:
                continue
            if any(not _translatable(child) for child in node.iterdescendants()):
                continue
            if parent not in self.siblings:
                self.siblings[parent] = _sibling_translations(parent)
            siblings = self.siblings[parent].get(node, {})
            translated = siblings.get(self.locale)
            if self.locale in siblings and translated is None:
                raise MetadataError("ambiguous_translations")
            if translated is not None and any(
                not _translatable(child) for child in translated.iter()
            ):
                continue
            key = self.tree.getpath(node)
            unit = TranslationUnit(
                id=key,
                field=field,
                context=context,
                source=_value(node, field, markup),
                translation=_value(translated, field, markup),
                markup=markup,
            )
            self.nodes[key] = UnitNode(unit, node, translated)

    def missing_counts(self, fields: set[str] | None = None):
        counts = {}
        blocked = {"en", "en_US"}
        total = 0
        for entry in self.nodes.values():
            included = fields is None or entry.unit.field in fields
            total += included
            for locale, node in (
                self.siblings[entry.source.getparent()].get(entry.source, {}).items()
            ):
                if not re.fullmatch(LOCALE_PATTERN, locale):
                    continue
                if node is None:
                    blocked.add(locale)
                elif included and (
                    any(not _translatable(child) for child in node.iter())
                    or _value(node, entry.unit.field, entry.unit.markup).strip()
                ):
                    counts[locale] = counts.get(locale, 0) - 1
        counts = {locale: total + delta for locale, delta in counts.items()}
        counts["*"] = total
        counts.update(dict.fromkeys(blocked, 0))
        return counts

    def units(self) -> list[TranslationUnit]:
        priority = {"summary": 0, "description": 1}
        return sorted(
            (node.unit for node in self.nodes.values()),
            key=lambda unit: priority.get(unit.field, 2),
        )

    def with_pending(self, content: bytes) -> "MetadataDocument":
        try:
            pending = MetadataDocument(content, self.app_id, self.locale)
        except MetadataError as error:
            raise MetadataError("source_changed") from error
        original_nodes = list(self.nodes.values())
        pending_nodes = list(pending.nodes.values())
        if len(original_nodes) != len(pending_nodes):
            raise MetadataError("source_changed")
        anchored = {}
        for original, updated in zip(original_nodes, pending_nodes, strict=True):
            if (
                original.unit.field,
                original.unit.context,
                original.unit.source,
            ) != (updated.unit.field, updated.unit.context, updated.unit.source):
                raise MetadataError("source_changed")
            # Inserting translated siblings shifts XPath indexes.
            updated.unit.id = original.unit.id
            anchored[original.unit.id] = updated
        pending.nodes = anchored
        pending.anchored_to = self
        return pending

    def apply(self, changes: dict[str, str]) -> bytes:
        if self.locale is None:
            raise MetadataError("invalid_locale")
        if not changes or changes.keys() - self.nodes.keys():
            raise MetadataError("invalid_units")
        if any(INVALID_XML_CHARACTERS.search(value) for value in changes.values()):
            raise MetadataError("invalid_characters")
        if sum(len(value.encode()) for value in changes.values()) > MAX_XML_BYTES:
            raise MetadataError("metadata_too_large")
        changed = False
        for key, value in changes.items():
            entry = self.nodes[key]
            value = value.strip()
            if value == entry.unit.translation:
                continue
            changed = True
            replacement = None
            if value:
                replacement = copy.deepcopy(entry.source)
                for child in list(replacement):
                    replacement.remove(child)
                replacement.text = None
                replacement.set(LANG, self.locale)
                if entry.unit.field == "keywords":
                    keywords = [
                        line.strip() for line in value.splitlines() if line.strip()
                    ]
                    if not keywords or len(keywords) != len(set(keywords)):
                        raise MetadataError("invalid_keywords")
                    for keyword in keywords:
                        etree.SubElement(replacement, "keyword").text = keyword
                elif entry.unit.markup:
                    try:
                        fragment = etree.fromstring(
                            f"<translation>{value}</translation>".encode(),
                            etree.XMLParser(resolve_entities=False, no_network=True),
                        )
                    except etree.XMLSyntaxError as error:
                        raise MetadataError("invalid_markup") from error
                    for child in fragment.iterdescendants():
                        if child.tag not in {"em", "code"} or child.attrib:
                            raise MetadataError("invalid_markup")
                    # Inline code frequently contains placeholders or commands.
                    original_code = sorted(
                        "".join(e.itertext()) for e in entry.source.iter("code")
                    )
                    if (
                        sorted("".join(e.itertext()) for e in fragment.iter("code"))
                        != original_code
                    ):
                        raise MetadataError("changed_code")
                    replacement.text = fragment.text
                    for child in list(fragment):
                        replacement.append(child)
                else:
                    replacement.text = value
            parent = entry.source.getparent()
            if entry.translated is not None:
                if replacement is None:
                    # After deletion, position alone can't identify the remaining translations.
                    # Move each beside its original first, even if it isn't editable.
                    for source, siblings in _sibling_translations(parent).items():
                        if (
                            source.tag != entry.source.tag
                            or self.locale not in siblings
                        ):
                            continue
                        translated = siblings[self.locale]
                        if translated is None:
                            raise MetadataError("ambiguous_translations")
                        source.addnext(translated)
                    parent.remove(entry.translated)
                else:
                    replacement.tail = entry.translated.tail
                    parent.replace(entry.translated, replacement)
            elif replacement is not None:
                entry.source.addnext(replacement)
        if not changed:
            raise MetadataError("no_changes")
        result = etree.tostring(
            self.tree,
            encoding="UTF-8",
            xml_declaration=self.content.lstrip().startswith(b"<?xml"),
        )
        if self.content.endswith(b"\n") and not result.endswith(b"\n"):
            result += b"\n"
        if len(result) > MAX_XML_BYTES:
            raise MetadataError("metadata_too_large")
        return result
