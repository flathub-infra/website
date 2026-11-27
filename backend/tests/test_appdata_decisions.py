import os
import sys

import httpx
import pytest

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import config, http_client
from app.moderation import appdata_decisions
from tests.shared_fixtures import (
    decision_post,
    decision_reply,
    enable_decisions,
)


def _decide(
    field="summary",
    old_value="Import games from other launchers into Steam",
    new_value="Import all your games into Steam",
    description=None,
):
    return appdata_decisions.auto_approve_change(
        field=field,
        app_id="dev.creeperkatze.full-steam-ahead",
        app_name="Full Steam Ahead",
        summary="Import all your games into Steam",
        description=description,
        old_value=old_value,
        new_value=new_value,
        build_id=42,
        job_id=7,
    )


def _without(path):
    payload = decision_reply()
    *parents, key = path
    target = payload
    for parent in parents:
        target = target[parent]
    del target[key]
    return payload


def _timeout(url, **kwargs):
    raise httpx.ReadTimeout("timed out")


def _threshold_cases(field, threshold, risk_limit, risks):
    below = round(threshold - 0.01, 2)
    return [
        pytest.param(field, {"benign": threshold}, True, id=f"{field}-benign-at"),
        pytest.param(field, {"benign": below}, False, id=f"{field}-benign-below"),
        pytest.param(field, {"same_app": threshold}, True, id=f"{field}-same-app-at"),
        pytest.param(field, {"same_app": below}, False, id=f"{field}-same-app-below"),
        *(
            pytest.param(field, {risk: risk_limit}, False, id=f"{field}-{risk}-at")
            for risk in risks
        ),
    ]


@pytest.mark.parametrize(
    ("field", "scores", "approved"),
    [
        *_threshold_cases(
            "summary", 0.9, 0.3, ("promo", "hype", "brand", "harmful", "junk")
        ),
        *_threshold_cases(
            "name", 0.95, 0.2, ("brand", "stuffing", "junk", "harmful", "promo")
        ),
    ],
)
def test_decision_thresholds(monkeypatch, field, scores, approved):
    enable_decisions(monkeypatch, decision_post(decision_reply(field, **scores)))

    decision = _decide(field, "Old", "New")

    assert (decision.field, decision.approved) == (field, approved)


def test_decision_rejects_reply_for_other_field(monkeypatch):
    enable_decisions(monkeypatch, decision_post(decision_reply("summary")))

    assert _decide("name", "Old", "New") is None


@pytest.mark.parametrize(
    "post",
    [
        pytest.param(decision_post(_without(["answers", "junk"])), id="missing-answer"),
        pytest.param(
            decision_post(_without(["answers", "hype", "type"])), id="missing-type"
        ),
        pytest.param(
            decision_post(
                _without(["answers", "disposition", "probabilities", "needs_review"])
            ),
            id="missing-probability",
        ),
        pytest.param(
            decision_post(decision_reply(choice="needs_review")),
            id="contradictory-choice",
        ),
        pytest.param(decision_post(decision_reply(same_app=True)), id="boolean"),
        pytest.param(decision_post(decision_reply(promo="0.05")), id="string"),
        pytest.param(decision_post(decision_reply(harmful=1.5)), id="out-of-range"),
        pytest.param(decision_post(decision_reply(junk=float("nan"))), id="nan"),
        pytest.param(decision_post(content=b"{not json"), id="malformed-json"),
        pytest.param(decision_post(status_code=429), id="http-status"),
        pytest.param(_timeout, id="timeout"),
        pytest.param(None, id="invalid-endpoint"),
    ],
)
def test_decision_failure_retains_review(monkeypatch, post):
    enable_decisions(monkeypatch, post or http_client.post)
    if post is None:
        monkeypatch.setattr(
            config.settings, "decisions_api", "https://decisions.example:port/v1"
        )

    assert _decide() is None


@pytest.mark.parametrize(
    ("settings", "values"),
    [
        pytest.param({"decisions_api": None}, {}, id="missing-endpoint"),
        pytest.param({"decisions_api": " "}, {}, id="blank-endpoint"),
        pytest.param({"decisions_api_key": None}, {}, id="missing-key"),
        pytest.param({"decisions_api_key": ""}, {}, id="blank-key"),
        pytest.param({"decisions_model": " "}, {}, id="blank-model"),
        pytest.param({}, {"old_value": " "}, id="blank-old-value"),
        pytest.param({}, {"new_value": ""}, id="blank-new-value"),
    ],
)
def test_unconfigured_decision_skips_request(monkeypatch, settings, values):
    def post(url, **kwargs):
        pytest.fail("appdata decision requested")

    enable_decisions(monkeypatch, post)
    for name, value in settings.items():
        monkeypatch.setattr(config.settings, name, value)

    assert _decide(**values) is None


def test_decision_sends_plain_text_description(monkeypatch):
    requests = []

    def post(url, **kwargs):
        requests.append(kwargs["json"])
        return decision_post()(url, **kwargs)

    enable_decisions(monkeypatch, post)

    _decide(
        description="<p>Import <em>games</em>\n  from &amp; to\n Steam.</p>"
        "<ul><li>Heroic</li><li>Lutris</li></ul>",
    )

    assert requests[0]["state"]["description"] == (
        "Import games from & to Steam.\n- Heroic\n- Lutris"
    )
