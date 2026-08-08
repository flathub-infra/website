import argparse
import copy
import json
import math
import re
import statistics
import time
from pathlib import Path
from typing import Any

import meilisearch
import meilisearch.errors

from app import config
from app.search_setup import build_embedder_settings

CURRENT_RANKING_RULES = [
    "words",
    "typo",
    "proximity",
    "attributeRank",
    "sort",
    "wordPosition",
    "exactness",
]
LEXICAL_FIXED_RANKING_RULES = [
    "words",
    "typo",
    "proximity",
    "attributeRank",
    "wordPosition",
    "exactness",
    "sort",
]
APP_ID_PATTERN = re.compile(r"[A-Za-z0-9_-]+(?:\.[A-Za-z0-9_-]+){2,}")
DEFAULT_DIMENSIONS = [1024, 2048, 4096]
DEFAULT_SEMANTIC_RATIOS = [0.2, 0.3, 0.4, 0.5]


def _wait_for_task(client: Any, task: Any) -> Any:
    result = client.wait_for_task(
        task.task_uid, timeout_in_ms=1_800_000, interval_in_ms=1_000
    )
    if result.status != "succeeded":
        raise RuntimeError(
            f"Meilisearch task {task.task_uid} ended with {result.status}"
        )
    return result


def _stats(client: Any, index_uid: str) -> dict[str, Any]:
    return client.http.get(f"/indexes/{index_uid}/stats")


def _global_stats(client: Any) -> dict[str, Any]:
    return client.http.get("/stats")


def _document_count(client: Any, index_uid: str) -> int:
    return _stats(client, index_uid).get("numberOfDocuments", 0)


def _reset_work_index(client: Any, source_uid: str, work_uid: str) -> None:
    source = client.index(source_uid)
    try:
        task = client.delete_index(work_uid)
        _wait_for_task(client, task)
    except meilisearch.errors.MeilisearchApiError as error:
        if getattr(error, "code", None) != "index_not_found":
            raise

    primary_key = source.get_primary_key()
    task = client.create_index(work_uid, {"primaryKey": primary_key})
    _wait_for_task(client, task)


def _copy_source_to_work(client: Any, source_uid: str, work_uid: str) -> None:
    source = client.index(source_uid)
    target = client.index(work_uid)
    settings = copy.deepcopy(source.get_settings())
    settings.pop("embedders", None)

    task = target.update_settings(settings)
    _wait_for_task(client, task)

    offset = 0
    while True:
        page = source.get_documents({"offset": offset, "limit": 1000})
        documents = [dict(document) for document in page.results]
        if not documents:
            break
        task = target.update_documents(documents)
        _wait_for_task(client, task)
        offset += len(documents)
        if offset >= page.total:
            break

    if _document_count(client, source_uid) != _document_count(client, work_uid):
        raise RuntimeError("source and evaluation index document counts differ")


def _set_ranking_rules(client: Any, index_uid: str, rules: list[str]) -> None:
    task = client.index(index_uid).update_ranking_rules(rules)
    _wait_for_task(client, task)


def _is_app_id_query(query: str) -> bool:
    return bool(APP_ID_PATTERN.fullmatch(query.strip()))


def _search_options() -> dict[str, Any]:
    return {
        "hitsPerPage": 20,
        "page": 1,
        "sort": ["installs_last_month:desc"],
        "filter": "type IN [desktop-application, console-application] AND NOT icon IS NULL",
    }


def _ranked_app_ids(response: dict[str, Any]) -> list[str]:
    ranked_ids = []
    for hit in response.get("hits", []):
        app_id = hit.get("app_id") or hit.get("id")
        if isinstance(app_id, str):
            ranked_ids.append(app_id)
    return ranked_ids


def _run_queries(
    client: Any,
    index_uid: str,
    cases: list[dict[str, Any]],
    mode: str,
    semantic_ratio: float | None = None,
    embedder: str | None = None,
) -> dict[str, Any]:
    results = []
    for case in cases:
        options = _search_options()
        if mode == "hybrid" and not _is_app_id_query(case["query"]):
            options["hybrid"] = {
                "embedder": embedder,
                "semanticRatio": semantic_ratio,
            }

        started_at = time.perf_counter()
        response = client.index(index_uid).search(case["query"], options)
        end_to_end_duration_ms = (time.perf_counter() - started_at) * 1000
        results.append(
            {
                "query": case["query"],
                "locale": case["locale"],
                "kind": case["kind"],
                "ranked_app_ids": _ranked_app_ids(response),
                "processing_time_ms": response.get("processingTimeMs"),
                "end_to_end_duration_ms": end_to_end_duration_ms,
            }
        )
    return {"mode": mode, "results": results}


def _validate_cases(cases: Any) -> list[dict[str, Any]]:
    if not isinstance(cases, list):
        raise ValueError("cases must be an array")
    validated = []
    for case in cases:
        if not isinstance(case, dict):
            raise ValueError("each case must be an object")
        if not isinstance(case.get("query"), str) or not isinstance(
            case.get("locale"), str
        ):
            raise ValueError("case query and locale must be strings")
        if case.get("kind") not in {"exploratory", "known-item"}:
            raise ValueError("case kind must be exploratory or known-item")
        judgments = case.get("judgments")
        if not isinstance(judgments, dict):
            raise ValueError("case judgments must be an object")
        if any(
            not isinstance(app_id, str) or grade not in {1, 2, 3}
            for app_id, grade in judgments.items()
        ):
            raise ValueError("judgments must map app IDs to grades 1, 2, or 3")
        validated.append(
            {
                "query": case["query"],
                "locale": case["locale"],
                "kind": case["kind"],
                "judgments": judgments,
            }
        )
    return validated


def _percentile(values: list[float], percentile: int) -> float | None:
    if not values:
        return None
    rank = max(1, math.ceil(percentile * len(values) / 100))
    return sorted(values)[rank - 1]


def _query_metrics(case: dict[str, Any], ranked_app_ids: list[str]) -> dict[str, float]:
    judgments = case["judgments"]
    relevant = {app_id for app_id, grade in judgments.items() if grade >= 2}
    if not relevant:
        raise ValueError(f"case has no grade-2-or-3 judgment: {case['query']}")

    reciprocal_rank = 0.0
    for rank, app_id in enumerate(ranked_app_ids, start=1):
        if judgments.get(app_id, 0) >= 2:
            reciprocal_rank = 1 / rank
            break

    top_ten = ranked_app_ids[:10]
    recall = len(relevant.intersection(top_ten)) / len(relevant)
    dcg = sum(
        (2 ** judgments[app_id] - 1) / math.log2(rank + 1)
        for rank, app_id in enumerate(top_ten, start=1)
        if app_id in judgments
    )
    ideal_grades = sorted(judgments.values(), reverse=True)[:10]
    ideal_dcg = sum(
        (2**grade - 1) / math.log2(rank + 1)
        for rank, grade in enumerate(ideal_grades, start=1)
    )
    return {
        "mrr": reciprocal_rank,
        "recall_at_10": recall,
        "ndcg_at_10": dcg / ideal_dcg if ideal_dcg else 0.0,
    }


def _metrics_for_run(
    run: dict[str, Any], cases_by_query: dict[str, dict[str, Any]]
) -> dict[str, Any]:
    grouped: dict[str, list[dict[str, float]]] = {}
    timings = []
    for result in run["results"]:
        case = cases_by_query[result["query"]]
        metrics = _query_metrics(case, result["ranked_app_ids"])
        grouped.setdefault("overall", []).append(metrics)
        grouped.setdefault(case["kind"], []).append(metrics)
        grouped.setdefault(case["locale"], []).append(metrics)
        if isinstance(result["processing_time_ms"], (int, float)):
            timings.append(float(result["processing_time_ms"]))

    cohorts = {}
    for name, values in grouped.items():
        cohorts[name] = {
            metric: statistics.mean(value[metric] for value in values)
            for metric in ("mrr", "recall_at_10", "ndcg_at_10")
        }

    end_to_end = [float(result["end_to_end_duration_ms"]) for result in run["results"]]
    return {
        "cohorts": cohorts,
        "latency_ms": {
            "meilisearch_p50": _percentile(timings, 50),
            "meilisearch_p95": _percentile(timings, 95),
            "meilisearch_p99": _percentile(timings, 99),
            "end_to_end_p50": _percentile(end_to_end, 50),
            "end_to_end_p95": _percentile(end_to_end, 95),
            "end_to_end_p99": _percentile(end_to_end, 99),
        },
    }


def _known_item_rank_one(
    run: dict[str, Any], cases_by_query: dict[str, dict[str, Any]]
) -> bool:
    for result in run["results"]:
        case = cases_by_query[result["query"]]
        if case["kind"] == "known-item":
            relevant = {
                app_id for app_id, grade in case["judgments"].items() if grade >= 2
            }
            if (
                not result["ranked_app_ids"]
                or result["ranked_app_ids"][0] not in relevant
            ):
                return False
    return True


def _relative_change(value: float, baseline: float) -> float:
    if baseline == 0:
        return 0.0 if value == 0 else float("inf")
    return (value - baseline) / baseline


def _select_production(
    runs: list[dict[str, Any]], cases_by_query: dict[str, dict[str, Any]]
) -> dict[str, Any] | None:
    lexical_fixed = next(run for run in runs if run["mode"] == "lexical-fixed")
    baseline = lexical_fixed["metrics"]
    candidates = []
    for run in runs:
        if run["mode"] != "hybrid":
            continue
        metrics = run["metrics"]
        if not _known_item_rank_one(run, cases_by_query):
            continue
        if (
            _relative_change(
                metrics["cohorts"]["known-item"]["mrr"],
                baseline["cohorts"]["known-item"]["mrr"],
            )
            < -0.02
        ):
            continue
        if (
            _relative_change(
                metrics["cohorts"]["known-item"]["ndcg_at_10"],
                baseline["cohorts"]["known-item"]["ndcg_at_10"],
            )
            < -0.02
        ):
            continue
        if (
            _relative_change(
                metrics["cohorts"]["exploratory"]["ndcg_at_10"],
                baseline["cohorts"]["exploratory"]["ndcg_at_10"],
            )
            < 0.05
        ):
            continue
        if (
            _relative_change(
                metrics["cohorts"]["exploratory"]["recall_at_10"],
                baseline["cohorts"]["exploratory"]["recall_at_10"],
            )
            < -0.02
        ):
            continue
        candidates.append(run)

    if not candidates:
        return None

    best_ndcg = max(
        run["metrics"]["cohorts"]["exploratory"]["ndcg_at_10"] for run in candidates
    )
    candidates = [
        run
        for run in candidates
        if _relative_change(
            run["metrics"]["cohorts"]["exploratory"]["ndcg_at_10"], best_ndcg
        )
        >= -0.01
    ]
    best_recall = max(
        run["metrics"]["cohorts"]["exploratory"]["recall_at_10"] for run in candidates
    )
    candidates = [
        run
        for run in candidates
        if _relative_change(
            run["metrics"]["cohorts"]["exploratory"]["recall_at_10"], best_recall
        )
        >= -0.01
    ]
    selected = min(
        candidates,
        key=lambda run: (
            run["dimensions"],
            run["semantic_ratio"],
            run["metrics"]["latency_ms"]["end_to_end_p95"] or float("inf"),
        ),
    )
    return {
        "dimensions": selected["dimensions"],
        "semantic_ratio": selected["semantic_ratio"],
        "mode": selected["mode"],
    }


def _pool_top_twenty(runs: list[dict[str, Any]]) -> dict[str, list[str]]:
    pooled: dict[str, list[str]] = {}
    for run in runs:
        for result in run["results"]:
            app_ids = pooled.setdefault(result["query"], [])
            for app_id in result["ranked_app_ids"][:20]:
                if app_id not in app_ids:
                    app_ids.append(app_id)
    return pooled


def evaluate(args: argparse.Namespace) -> dict[str, Any]:
    if not args.work_index.startswith("apps-search-eval-"):
        raise ValueError("--work-index must start with apps-search-eval-")

    cases = _validate_cases(json.loads(Path(args.cases).read_text()))
    cases_by_query = {case["query"]: case for case in cases}
    if len(cases_by_query) != len(cases):
        raise ValueError("case queries must be unique")

    client = meilisearch.Client(args.meilisearch_url, args.meilisearch_key)
    _reset_work_index(client, args.source_index, args.work_index)
    _copy_source_to_work(client, args.source_index, args.work_index)
    work_database_size = _global_stats(client).get("databaseSize")

    runs = []
    for mode, rules in (
        ("lexical-current", CURRENT_RANKING_RULES),
        ("lexical-fixed", LEXICAL_FIXED_RANKING_RULES),
    ):
        _set_ranking_rules(client, args.work_index, rules)
        run = _run_queries(client, args.work_index, cases, mode)
        run["metrics"] = _metrics_for_run(run, cases_by_query)
        runs.append(run)

    for dimensions in args.dimensions:
        embedding_started_at = time.perf_counter()
        task = client.index(args.work_index).update_embedders(
            build_embedder_settings(config.settings, dimensions=dimensions)
        )
        task_result = _wait_for_task(client, task)
        embedding_duration_ms = (time.perf_counter() - embedding_started_at) * 1000
        stats = _stats(client, args.work_index)
        current_database_size = _global_stats(client).get("databaseSize")
        document_count = stats.get("numberOfDocuments", 0)
        embedded_count = stats.get("numberOfEmbeddedDocuments")
        if embedded_count != document_count:
            raise RuntimeError(
                "evaluation index does not have complete embedding coverage"
            )
        for semantic_ratio in args.semantic_ratios:
            run = _run_queries(
                client,
                args.work_index,
                cases,
                "hybrid",
                semantic_ratio=semantic_ratio,
                embedder=config.settings.search_hybrid_embedder,
            )
            run["dimensions"] = dimensions
            run["semantic_ratio"] = semantic_ratio
            run["embedding_duration_ms"] = embedding_duration_ms
            run["embedding_task_status"] = task_result.status
            run["database_growth_bytes"] = (
                current_database_size - work_database_size
                if isinstance(current_database_size, (int, float))
                and isinstance(work_database_size, (int, float))
                else None
            )
            run["fireworks_tokens"] = None
            run["metrics"] = _metrics_for_run(run, cases_by_query)
            runs.append(run)
    return {
        "source_index": args.source_index,
        "work_index": args.work_index,
        "dimensions": args.dimensions,
        "semantic_ratios": args.semantic_ratios,
        "pooled_top_twenty": _pool_top_twenty(runs),
        "runs": runs,
        "selected_production": _select_production(runs, cases_by_query),
    }


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser()
    parser.add_argument("--meilisearch-url", required=True)
    parser.add_argument("--meilisearch-key", required=True)
    parser.add_argument("--source-index", default="apps")
    parser.add_argument("--work-index", required=True)
    parser.add_argument("--cases", required=True)
    parser.add_argument(
        "--dimensions", action="append", type=int, default=DEFAULT_DIMENSIONS
    )
    parser.add_argument(
        "--semantic-ratios",
        action="append",
        type=float,
        default=DEFAULT_SEMANTIC_RATIOS,
    )
    parser.add_argument("--output", required=True)
    return parser


def main() -> None:
    args = build_parser().parse_args()
    output = evaluate(args)
    Path(args.output).write_text(json.dumps(output, indent=2) + "\n")


if __name__ == "__main__":
    main()
