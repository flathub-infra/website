import json
import os
import sys
from pathlib import Path

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


def test_seed_cases_block_automatic_selection():
    cases = evaluate_search._validate_cases(
        json.loads(Path(ROOT_DIR, "utils", "search_relevance_cases.json").read_text())
    )
    cases_by_query = {case["query"]: case for case in cases}

    blockers = evaluate_search._selection_blockers(cases_by_query)

    assert blockers
    assert evaluate_search._select_production([], cases_by_query) is None


def test_production_selection_uses_current_lexical_baseline(monkeypatch):
    cases_by_query = {
        "explore": {
            "query": "explore",
            "kind": "exploratory",
            "judgments": {"org.example.App": 3},
        },
        "known": {
            "query": "known",
            "kind": "known-item",
            "judgments": {"org.example.App": 3},
        },
    }
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
                {"query": "explore", "ranked_app_ids": ["org.example.App"]},
                {"query": "known", "ranked_app_ids": ["org.example.App"]},
            ],
            "metrics": {
                "cohorts": {
                    "known-item": {"mrr": 0.5, "ndcg_at_10": 0.5},
                    "exploratory": {"ndcg_at_10": 0.6, "recall_at_10": 1.0},
                },
                "latency_ms": {"end_to_end_p95": 1.0},
            },
            "dimensions": 1024,
            "semantic_ratio": 0.2,
        },
    ]

    assert evaluate_search._select_production(runs, cases_by_query) is None
