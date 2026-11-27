import logging
from dataclasses import dataclass

import httpx
from lxml import etree

from .. import config, http_client, models
from ..types import JSONValue, is_json_object

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class _Field:
    questions: dict[str, JSONValue]
    benign: str
    risks: tuple[str, ...]
    threshold: float
    risk_limit: float


_SUMMARY = _Field(
    questions={
        "disposition": {
            "type": "choice",
            "instructions": "A Flatpak app changed its one-line AppStream summary. Moderators must review changes that could mislead users, abuse the store listing, or turn the listing into a different product. Classify the change from old_summary to new_summary.",
            "criteria": {
                "benign_rewrite": "Ordinary editorial change describing the same application: rewording, shortening, expanding, adding or removing features, translation, style or grammar fixes.",
                "needs_review": "Anything a store moderator should look at: describes a different kind of application, advertising, links or contact details, donation requests, keyword stuffing, emoji spam, hype or unverifiable superlatives, claims of official status or a third-party brand, offensive or adult content, placeholder or junk text, wrapping in quotes, or version/release notes.",
            },
        },
        "same_app": {
            "type": "noul",
            "instructions": "Do old_summary and new_summary describe the same application with the same core purpose?",
            "criteria": {
                "true": "Same product; wording, scope or feature list may differ. A vaguer, more specific or differently framed description of the same purpose is the same product. When old_summary is a slogan or too vague to pin down a purpose, a new_summary consistent with it is the same product.",
                "false": "The new summary describes a different kind of product, or is not a description of the product at all.",
            },
        },
        "brand": {
            "type": "noul",
            "instructions": "Does new_summary claim official status, affiliation with, or identity of a company, brand or trademark that old_summary did not claim? Naming products, services, formats or platforms that the app works with, is a client for, integrates with, imports from or exports to is not such a claim, nor is a trademark already named in old_summary.",
        },
        "harmful": {
            "type": "noul",
            "instructions": "Does new_summary contain offensive, hateful, sexual, scam, malware or illegal content?",
        },
        "junk": {
            "type": "noul",
            "instructions": "Is new_summary a placeholder, test string, junk text, release note, or wrapped in quotation marks rather than a real description of the app? A short, plain description of what the app does is not junk.",
        },
        "promo": {
            "type": "noul",
            "instructions": "Does new_summary contain a URL, domain, email address, social media or chat invite, donation request, price, or an advertisement for another product or paid version?",
        },
        "hype": {
            "type": "noul",
            "instructions": "Does new_summary add keyword stuffing, emoji spam, or exaggerated, unverifiable marketing claims such as 'best', '#1', 'the only', or '100%'? Plain imperative descriptions like 'Play chess' or 'Edit photos' are not marketing.",
        },
    },
    benign="benign_rewrite",
    risks=("promo", "hype", "brand", "harmful", "junk"),
    threshold=0.9,
    risk_limit=0.3,
)

_NAME = _Field(
    questions={
        "disposition": {
            "type": "choice",
            "instructions": "A Flatpak app changed its AppStream name, the title shown on its store page. Moderators must review renames that could mislead users, abuse the store listing, or turn the listing into a different product. Classify the change from old_name to new_name; summary describes the app.",
            "criteria": {
                "benign_rename": "Ordinary rename of the same application: rebranding to a new product name, shortening, expanding, translating, fixing spelling, capitalisation or spacing, dropping or adding a qualifier like edition or platform.",
                "needs_review": "Anything a store moderator should look at: a name for a different kind of application, a generic descriptive name or keywords instead of a product name, appended slogans or feature lists, emoji, claims of official status or a third-party brand, links or contact details, offensive content, placeholder or junk text.",
            },
        },
        "same_app": {
            "type": "noul",
            "instructions": "Do old_name and new_name plausibly name the same application with the same purpose described by summary? A rebrand to an unrelated-sounding new product name is still the same app if nothing suggests a different purpose.",
        },
        "brand": {
            "type": "noul",
            "instructions": "Does new_name claim official status, affiliation with, or identity of a company, brand or trademark that old_name did not claim? Naming a product or service the app is a client for is such a claim only when it reads as the official app of that brand.",
        },
        "stuffing": {
            "type": "noul",
            "instructions": "Does new_name add keyword stuffing, a slogan, a feature list, marketing words like 'best' or 'free', or emoji instead of being a product name?",
        },
        "junk": {
            "type": "noul",
            "instructions": "Is new_name a placeholder, test string, version number, or junk text rather than a real application name?",
        },
        "harmful": {
            "type": "noul",
            "instructions": "Does new_name contain offensive, hateful, sexual, scam or illegal content?",
        },
        "promo": {
            "type": "noul",
            "instructions": "Does new_name contain a URL, domain, email address, price, or advertisement?",
        },
    },
    benign="benign_rename",
    risks=("brand", "stuffing", "junk", "harmful", "promo"),
    threshold=0.95,
    risk_limit=0.2,
)

FIELDS = {"summary": _SUMMARY, "name": _NAME}


def _probability(value: object) -> float:
    if isinstance(value, bool) or not isinstance(value, int | float):
        raise TypeError("Probability must be a number")
    if not 0.0 <= value <= 1.0:
        raise ValueError("Probability must be finite and within [0, 1]")
    return float(value)


def _plain_text(description: str) -> str:
    root = etree.fromstring(f"<description>{description}</description>")
    return "\n".join(
        ("- " if element.tag == "li" else "")
        + " ".join("".join(element.itertext()).split())
        for element in root.iter("p", "li")
    )


def _state(
    field: str,
    app_id: str,
    app_name: str | None,
    summary: str | None,
    description: str | None,
    old_value: str,
    new_value: str,
) -> dict[str, JSONValue]:
    if field == "summary":
        return {
            "app_id": app_id,
            "app_name": app_name,
            "old_summary": old_value,
            "new_summary": new_value,
            "description": _plain_text(description) if description else None,
        }
    return {
        "app_id": app_id,
        "old_name": old_value,
        "new_name": new_value,
        "summary": summary,
    }


def _evaluate(spec: _Field, payload: object) -> tuple[str, JSONValue, bool]:
    if not is_json_object(payload):
        raise TypeError("Response must be a JSON object")
    model = payload["model"]
    answers = payload["answers"]
    if not isinstance(model, str) or not model.strip():
        raise TypeError("Response model must be a nonblank string")
    if not is_json_object(answers):
        raise TypeError("Response answers must be a JSON object")

    disposition = answers["disposition"]
    if not is_json_object(disposition) or disposition["type"] != "choice":
        raise TypeError("Disposition must be a choice answer")
    probabilities = disposition["probabilities"]
    choices = {spec.benign, "needs_review"}
    if not is_json_object(probabilities) or probabilities.keys() != choices:
        raise ValueError("Disposition probabilities must cover both categories")
    categories = {name: _probability(probabilities[name]) for name in choices}
    _probability(disposition["confidence"])
    choice = disposition["choice"]
    if not isinstance(choice, str) or choice not in categories:
        raise ValueError("Disposition choice must be a known category")
    if abs(sum(categories.values()) - 1.0) > 0.02:
        raise ValueError("Disposition probabilities must sum to one")
    if categories[choice] < max(categories.values()):
        raise ValueError("Disposition choice must be a highest-probability category")

    scores: dict[str, float] = {}
    for name in ("same_app", *spec.risks):
        answer = answers[name]
        if not is_json_object(answer) or answer["type"] != "noul":
            raise TypeError(f"Answer {name} must be a noul answer")
        scores[name] = _probability(answer["noul"])

    approve = (
        choice == spec.benign
        and categories[spec.benign] >= spec.threshold
        and scores["same_app"] >= spec.threshold
        and all(scores[name] < spec.risk_limit for name in spec.risks)
    )
    return model, answers, approve


def auto_approve_change(
    *,
    field: str,
    app_id: str,
    app_name: str | None,
    summary: str | None,
    description: str | None,
    old_value: str,
    new_value: str,
    build_id: int,
    job_id: int,
) -> models.AppdataDecision | None:
    spec = FIELDS[field]
    endpoint = config.settings.decisions_api
    api_key = config.settings.decisions_api_key
    requested_model = config.settings.decisions_model
    if (
        not endpoint
        or not api_key
        or not all(
            value.strip()
            for value in (endpoint, api_key, requested_model, old_value, new_value)
        )
    ):
        return None

    try:
        response = http_client.post(
            endpoint,
            headers={"Authorization": f"Bearer {api_key}"},
            json={
                "model": requested_model,
                "state": _state(
                    field,
                    app_id,
                    app_name,
                    summary,
                    description,
                    old_value,
                    new_value,
                ),
                "questions": spec.questions,
            },
            timeout=httpx.Timeout(2.0),
        )
        response.raise_for_status()
        model, answers, approve = _evaluate(spec, response.json())
    except (httpx.HTTPError, httpx.InvalidURL, ValueError, KeyError, TypeError) as exc:
        logger.warning(
            "Appdata decision unavailable; retaining human review",
            extra={
                "app_id": app_id,
                "field": field,
                "build_id": build_id,
                "job_id": job_id,
                "requested_model": requested_model,
                "error_type": type(exc).__name__,
            },
        )
        return None

    logger.info(
        "Evaluated appdata change for app",
        extra={
            "app_id": app_id,
            "field": field,
            "build_id": build_id,
            "job_id": job_id,
            "requested_model": requested_model,
            "model": model,
            "answers": answers,
            "decision": "auto_approve" if approve else "human_review",
        },
    )
    return models.AppdataDecision(
        app_id=app_id,
        field=field,
        build_id=build_id,
        job_id=job_id,
        old_value=old_value,
        new_value=new_value,
        model=model,
        answers=answers,
        approved=approve,
    )
