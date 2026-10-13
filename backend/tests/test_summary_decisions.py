import os
import sys

import httpx
import pytest

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import config, http_client
from app.moderation import summary_decisions
from tests.shared_fixtures import (
    DECISION_RISKS,
    decision_post,
    decision_reply,
    enable_decisions,
)


def _decide(
    old_summary="Import games from other launchers into Steam",
    new_summary="Import all your games into Steam",
):
    return summary_decisions.auto_approve_summary_change(
        app_id="dev.creeperkatze.full-steam-ahead",
        app_name="Full Steam Ahead",
        old_summary=old_summary,
        new_summary=new_summary,
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


@pytest.mark.parametrize(
    ("scores", "approved"),
    [
        pytest.param({"benign": 0.8}, True, id="benign-at-threshold"),
        pytest.param({"same_app": 0.8}, True, id="same-app-at-threshold"),
        pytest.param({"benign": 0.79}, False, id="benign-below-threshold"),
        pytest.param({"same_app": 0.79}, False, id="same-app-below-threshold"),
        *(
            pytest.param({risk: 0.3}, False, id=f"{risk}-at-threshold")
            for risk in DECISION_RISKS
        ),
    ],
)
def test_decision_thresholds(monkeypatch, scores, approved):
    enable_decisions(monkeypatch, decision_post(decision_reply(**scores)))

    assert _decide().approved is approved


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
    ("settings", "summaries"),
    [
        pytest.param({"decisions_api": None}, {}, id="missing-endpoint"),
        pytest.param({"decisions_api": " "}, {}, id="blank-endpoint"),
        pytest.param({"decisions_api_key": None}, {}, id="missing-key"),
        pytest.param({"decisions_api_key": ""}, {}, id="blank-key"),
        pytest.param({"decisions_model": " "}, {}, id="blank-model"),
        pytest.param({}, {"old_summary": " "}, id="blank-old-summary"),
        pytest.param({}, {"new_summary": ""}, id="blank-new-summary"),
    ],
)
def test_unconfigured_decision_skips_request(monkeypatch, settings, summaries):
    def post(url, **kwargs):
        pytest.fail("summary decision requested")

    enable_decisions(monkeypatch, post)
    for name, value in settings.items():
        monkeypatch.setattr(config.settings, name, value)

    assert _decide(**summaries) is None
