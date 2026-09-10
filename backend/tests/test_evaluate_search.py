import json
import os
import sys
from pathlib import Path

import pytest

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.append(ROOT_DIR)

from app.search_index import RANKING_RULES
from utils import evaluate_search


def test_production_and_evaluator_use_current_lexical_ranking():
    assert evaluate_search.CURRENT_RANKING_RULES == RANKING_RULES
    assert (
        evaluate_search.CURRENT_RANKING_RULES
        != evaluate_search.LEXICAL_FIXED_RANKING_RULES
    )
    assert evaluate_search.CURRENT_RANKING_RULES[-1] == "exactness"
    assert evaluate_search.LEXICAL_FIXED_RANKING_RULES[-1] == "sort"


def test_seed_cases_satisfy_automatic_selection_gates():
    cases = evaluate_search._validate_cases(
        json.loads(Path(ROOT_DIR, "utils", "search_relevance_cases.json").read_text())
    )
    cases_by_key = {evaluate_search._case_key(case): case for case in cases}

    assert evaluate_search._selection_blockers(cases_by_key) == []


@pytest.mark.parametrize(
    ("filters", "expected_filter"),
    [
        (
            [],
            "type IN [desktop-application, console-application] AND NOT icon IS NULL",
        ),
        (
            [{"filterType": "type", "value": "desktop-application"}],
            "type = 'desktop-application' AND NOT icon IS NULL",
        ),
        (
            [{"filterType": "type", "value": "addon"}],
            "type = 'addon'",
        ),
        (
            [
                {"filterType": "type", "value": "desktop-application"},
                {"filterType": "type", "value": "addon"},
            ],
            "type = 'desktop-application' AND type = 'addon' AND NOT icon IS NULL",
        ),
    ],
)
def test_search_options_match_production_type_filters(filters, expected_filter):
    assert evaluate_search._search_options(filters)["filter"] == expected_filter


def test_no_match_cases_report_returned_hits_separately():
    case = evaluate_search._validate_cases(
        [
            {
                "query": "sdfjksdfasdgasdg",
                "locale": "en",
                "kind": "no-match",
                "judgments": {},
            }
        ]
    )[0]
    case_key = evaluate_search._case_key(case)
    run = {
        "results": [
            {
                "case_key": case_key,
                "ranked_app_ids": ["org.example.App"],
                "processing_time_ms": 1,
                "end_to_end_duration_ms": 2,
            }
        ]
    }

    metrics = evaluate_search._metrics_for_run(run, {case_key: case})

    assert metrics["cohorts"]["no-match"] == {
        "returned_hit_count": 1,
        "mean_returned_hits": 1,
        "false_positive_rate": 1,
    }


def test_no_match_cases_reject_judgments():
    with pytest.raises(ValueError, match="no-match cases must have empty judgments"):
        evaluate_search._validate_cases(
            [
                {
                    "query": "sdfjksdfasdgasdg",
                    "locale": "en",
                    "kind": "no-match",
                    "judgments": {"org.example.App": 3},
                }
            ]
        )


def test_production_selection_uses_current_lexical_baseline(monkeypatch):
    cases = evaluate_search._validate_cases(
        [
            {
                "query": "explore",
                "locale": "en",
                "kind": "exploratory",
                "judgments": {"org.example.App": 3},
            },
            {
                "query": "known",
                "locale": "en",
                "kind": "known-item",
                "judgments": {"org.example.App": 3},
            },
            {
                "query": "nonsense",
                "locale": "en",
                "kind": "no-match",
                "judgments": {},
            },
        ]
    )
    cases_by_key = {evaluate_search._case_key(case): case for case in cases}
    case_keys = {case["query"]: evaluate_search._case_key(case) for case in cases}
    monkeypatch.setattr(evaluate_search, "_selection_blockers", lambda _: [])
    runs = [
        {
            "mode": "lexical-current",
            "results": [],
            "metrics": {
                "cohorts": {
                    "known-item": {"mrr": 1.0, "ndcg_at_10": 1.0},
                    "exploratory": {"ndcg_at_10": 0.5, "recall_at_10": 1.0},
                }
            },
        },
        {
            "mode": "lexical-fixed",
            "results": [],
            "metrics": {
                "cohorts": {
                    "known-item": {"mrr": 0.5, "ndcg_at_10": 0.5},
                    "exploratory": {"ndcg_at_10": 0.5, "recall_at_10": 1.0},
                }
            },
        },
        {
            "mode": "hybrid",
            "results": [
                {
                    "case_key": case_keys["explore"],
                    "ranked_app_ids": ["org.example.App"],
                },
                {
                    "case_key": case_keys["known"],
                    "ranked_app_ids": ["org.example.App"],
                },
                {
                    "case_key": case_keys["nonsense"],
                    "ranked_app_ids": [],
                },
            ],
            "metrics": {
                "cohorts": {
                    "known-item": {"mrr": 0.5, "ndcg_at_10": 0.5},
                    "exploratory": {"ndcg_at_10": 0.6, "recall_at_10": 1.0},
                    "no-match": {"false_positive_rate": 0.0},
                },
                "latency_ms": {"end_to_end_p95": 1.0},
            },
            "dimensions": 1024,
            "semantic_ratio": 0.2,
            "ranking_score_threshold": 0.835,
        },
    ]

    assert evaluate_search._select_production(runs, cases_by_key) is None


def test_reset_work_index_creates_missing_index(monkeypatch):
    class IndexNotFound(Exception):
        code = "index_not_found"

    class SourceIndex:
        def get_primary_key(self):
            return "app_id"

    class Client:
        def __init__(self):
            self.created = []

        def index(self, _):
            return SourceIndex()

        def get_index(self, _):
            raise IndexNotFound()

        def create_index(self, uid, options):
            self.created.append((uid, options))
            return object()

    client = Client()
    monkeypatch.setattr(
        evaluate_search.meilisearch.errors, "MeilisearchApiError", IndexNotFound
    )
    monkeypatch.setattr(evaluate_search, "_wait_for_task", lambda *_: None)

    evaluate_search._reset_work_index(client, "apps", "apps-search-eval-test")

    assert client.created == [("apps-search-eval-test", {"primaryKey": "app_id"})]
