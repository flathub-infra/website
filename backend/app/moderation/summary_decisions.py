import logging

import httpx

from .. import config, http_client, models
from ..types import JSONValue, is_json_object

logger = logging.getLogger(__name__)

_QUESTIONS: dict[str, JSONValue] = {
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
            "true": "Same product; wording, scope or feature list may differ.",
            "false": "The new summary describes a different kind of product, or is not a description of the product at all.",
        },
    },
    "brand": {
        "type": "noul",
        "instructions": "Does new_summary claim official status, affiliation with, or identity of a company, brand or trademark that old_summary did not claim?",
    },
    "harmful": {
        "type": "noul",
        "instructions": "Does new_summary contain offensive, hateful, sexual, scam, malware or illegal content?",
    },
    "junk": {
        "type": "noul",
        "instructions": "Is new_summary a placeholder, test string, junk text, release note, or wrapped in quotation marks rather than a real description of the app?",
    },
    "promo": {
        "type": "noul",
        "instructions": "Does new_summary contain a URL, domain, email address, social media or chat invite, donation request, price, or an advertisement for another product or paid version?",
    },
    "hype": {
        "type": "noul",
        "instructions": "Does new_summary add keyword stuffing, emoji spam, or exaggerated, unverifiable marketing claims such as 'best', '#1', 'the only', or '100%'? Plain imperative descriptions like 'Play chess' or 'Edit photos' are not marketing.",
    },
}

_CHOICES = frozenset({"benign_rewrite", "needs_review"})
_RISKS = ("promo", "hype", "brand", "harmful", "junk")


def _probability(value: object) -> float:
    if isinstance(value, bool) or not isinstance(value, int | float):
        raise TypeError("Probability must be a number")
    if not 0.0 <= value <= 1.0:
        raise ValueError("Probability must be finite and within [0, 1]")
    return float(value)


def _evaluate(payload: object) -> tuple[str, JSONValue, bool]:
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
    if not is_json_object(probabilities) or probabilities.keys() != _CHOICES:
        raise ValueError("Disposition probabilities must cover both categories")
    categories = {name: _probability(probabilities[name]) for name in _CHOICES}
    _probability(disposition["confidence"])
    choice = disposition["choice"]
    if not isinstance(choice, str) or choice not in categories:
        raise ValueError("Disposition choice must be a known category")
    if abs(sum(categories.values()) - 1.0) > 0.02:
        raise ValueError("Disposition probabilities must sum to one")
    if categories[choice] < max(categories.values()):
        raise ValueError("Disposition choice must be a highest-probability category")

    scores: dict[str, float] = {}
    for name in ("same_app", *_RISKS):
        answer = answers[name]
        if not is_json_object(answer) or answer["type"] != "noul":
            raise TypeError(f"Answer {name} must be a noul answer")
        scores[name] = _probability(answer["noul"])

    approve = (
        choice == "benign_rewrite"
        and categories["benign_rewrite"] >= 0.8
        and scores["same_app"] >= 0.8
        and all(scores[name] < 0.3 for name in _RISKS)
    )
    return model, answers, approve


def auto_approve_summary_change(
    *,
    app_id: str,
    app_name: str | None,
    old_summary: str,
    new_summary: str,
    build_id: int,
    job_id: int,
) -> models.SummaryDecision | None:
    endpoint = config.settings.decisions_api
    api_key = config.settings.decisions_api_key
    requested_model = config.settings.decisions_model
    if (
        not endpoint
        or not api_key
        or not all(
            value.strip()
            for value in (endpoint, api_key, requested_model, old_summary, new_summary)
        )
    ):
        return None

    try:
        response = http_client.post(
            endpoint,
            headers={"Authorization": f"Bearer {api_key}"},
            json={
                "model": requested_model,
                "state": {
                    "app_id": app_id,
                    "app_name": app_name,
                    "old_summary": old_summary,
                    "new_summary": new_summary,
                },
                "questions": _QUESTIONS,
            },
            timeout=httpx.Timeout(2.0),
        )
        response.raise_for_status()
        model, answers, approve = _evaluate(response.json())
    except (httpx.HTTPError, httpx.InvalidURL, ValueError, KeyError, TypeError) as exc:
        logger.warning(
            "Summary decision unavailable; retaining human review",
            extra={
                "app_id": app_id,
                "build_id": build_id,
                "job_id": job_id,
                "requested_model": requested_model,
                "error_type": type(exc).__name__,
            },
        )
        return None

    logger.info(
        "Evaluated summary change for app",
        extra={
            "app_id": app_id,
            "build_id": build_id,
            "job_id": job_id,
            "requested_model": requested_model,
            "model": model,
            "answers": answers,
            "decision": "auto_approve" if approve else "human_review",
        },
    )
    return models.SummaryDecision(
        app_id=app_id,
        build_id=build_id,
        job_id=job_id,
        old_summary=old_summary,
        new_summary=new_summary,
        model=model,
        answers=answers,
        approved=approve,
    )
