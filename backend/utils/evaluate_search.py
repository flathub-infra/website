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
from app.search_index import RANKING_RULES
from app.search_setup import build_embedder_settings

CURRENT_RANKING_RULES = RANKING_RULES
LEXICAL_FIXED_RANKING_RULES = [
    "words",
    "typo",
    "proximity",
    "attributeRank",
    "wordPosition",
    "exactness",
    "sort",
]
MIN_SELECTION_CASES = 30
MIN_SELECTION_EXPLORATORY_CASES = 10
MIN_SELECTION_KNOWN_ITEM_CASES = 4
MIN_EXPLORATORY_JUDGMENTS = 3
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
        client.get_index(work_uid)
    except meilisearch.errors.MeilisearchApiError as error:
        if getattr(error, "code", None) != "index_not_found":
            raise
    else:
        task = client.delete_index(work_uid)
        _wait_for_task(client, task)

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


def _search_options(filters: list[dict[str, str]]) -> dict[str, Any]:
    filter_values = [
        f"{filter['filterType']} = '{filter['value']}'" for filter in filters
    ]
    filtering_for_type = any(filter["filterType"] == "type" for filter in filters)
    filtering_for_desktop_or_console = any(
        filter["filterType"] == "type"
        and filter["value"] in {"desktop-application", "console-application"}
        for filter in filters
    )
    if not filtering_for_type and not filtering_for_desktop_or_console:
        filter_values.append("type IN [desktop-application, console-application]")
    if not (filtering_for_type and not filtering_for_desktop_or_console):
        filter_values.append("NOT icon IS NULL")
    return {
        "hitsPerPage": 21,
        "page": 1,
        "sort": ["installs_last_month:desc"],
        "filter": " AND ".join(filter_values),
        "showRankingScore": True,
        "showRankingScoreDetails": True,
    }


def _case_key(case: dict[str, Any]) -> str:
    return json.dumps(
        [case["query"], case["locale"], case["filters"]],
        ensure_ascii=False,
        separators=(",", ":"),
        sort_keys=True,
    )


def _ranked_app_ids(response: dict[str, Any]) -> list[str]:
    ranked_ids = []
    for hit in response.get("hits", []):
        app_id = hit.get("app_id") or hit.get("id")
        if isinstance(app_id, str):
            ranked_ids.append(app_id)
    return ranked_ids


def _is_semantic_hit(value: Any) -> bool:
    if isinstance(value, dict):
        return any(
            key in {"semantic", "vector"} or _is_semantic_hit(nested_value)
            for key, nested_value in value.items()
        )
    if isinstance(value, list):
        return any(_is_semantic_hit(item) for item in value)
    return False


def _run_queries(
    client: Any,
    index_uid: str,
    cases: list[dict[str, Any]],
    mode: str,
    semantic_ratio: float | None = None,
    embedder: str | None = None,
    ranking_score_threshold: float | None = None,
) -> dict[str, Any]:
    results = []
    for case in cases:
        options = _search_options(case["filters"])
        if mode == "hybrid" and not _is_app_id_query(case["query"]):
            options["hybrid"] = {
                "embedder": embedder,
                "semanticRatio": semantic_ratio,
            }
            if ranking_score_threshold is not None:
                options["rankingScoreThreshold"] = ranking_score_threshold

        started_at = time.perf_counter()
        response = client.index(index_uid).search(case["query"], options)
        end_to_end_duration_ms = (time.perf_counter() - started_at) * 1000
        hit_details = [
            {
                "app_id": hit.get("app_id") or hit.get("id"),
                "ranking_score": hit.get("_rankingScore"),
                "ranking_score_details": hit.get("_rankingScoreDetails"),
            }
            for hit in response.get("hits", [])
        ]
        results.append(
            {
                "case_key": _case_key(case),
                "query": case["query"],
                "locale": case["locale"],
                "filters": case["filters"],
                "kind": case["kind"],
                "ranked_app_ids": _ranked_app_ids(response),
                "hit_details": hit_details,
                "semantic_hit_count": sum(
                    _is_semantic_hit(hit["ranking_score_details"])
                    for hit in hit_details
                ),
                "total_hits": response.get("totalHits"),
                "processing_time_ms": response.get("processingTimeMs"),
                "end_to_end_duration_ms": end_to_end_duration_ms,
            }
        )
    return {"mode": mode, "results": results}


def _validate_cases(cases: Any) -> list[dict[str, Any]]:
    if not isinstance(cases, list):
        raise TypeError("cases must be an array")
    validated = []
    for case in cases:
        if not isinstance(case, dict):
            raise TypeError("each case must be an object")
        if not isinstance(case.get("query"), str) or not isinstance(
            case.get("locale"), str
        ):
            raise TypeError("case query and locale must be strings")
        if case.get("kind") not in {"exploratory", "known-item", "no-match"}:
            raise ValueError("case kind must be exploratory, known-item, or no-match")
        judgments = case.get("judgments")
        if not isinstance(judgments, dict):
            raise TypeError("case judgments must be an object")
        if case["kind"] == "no-match" and judgments:
            raise ValueError("no-match cases must have empty judgments")
        if any(
            not isinstance(app_id, str) or grade not in {1, 2, 3}
            for app_id, grade in judgments.items()
        ):
            raise ValueError("judgments must map app IDs to grades 1, 2, or 3")
        filters = case.get("filters", [])
        if not isinstance(filters, list) or any(
            not isinstance(filter, dict)
            or not isinstance(filter.get("filterType"), str)
            or not isinstance(filter.get("value"), str)
            for filter in filters
        ):
            raise TypeError("case filters must be an array of filter objects")
        validated.append(
            {
                "query": case["query"],
                "locale": case["locale"],
                "filters": filters,
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
    run: dict[str, Any], cases_by_key: dict[str, dict[str, Any]]
) -> dict[str, Any]:
    grouped: dict[str, list[dict[str, float]]] = {}
    no_match_hit_counts = []
    positive_result_count = 0
    false_empty_positive_count = 0
    timings = []
    for result in run["results"]:
        case = cases_by_key[result["case_key"]]
        if case["kind"] == "no-match":
            no_match_hit_counts.append(len(result["ranked_app_ids"]))
        else:
            metrics = _query_metrics(case, result["ranked_app_ids"])
            grouped.setdefault("overall", []).append(metrics)
            grouped.setdefault(case["kind"], []).append(metrics)
            positive_result_count += 1
            false_empty_positive_count += not result["ranked_app_ids"]
            grouped.setdefault(case["locale"], []).append(metrics)
        if isinstance(result["processing_time_ms"], (int, float)):
            timings.append(float(result["processing_time_ms"]))

    cohorts = {}
    for name, values in grouped.items():
        cohorts[name] = {
            metric: statistics.mean(value[metric] for value in values)
            for metric in ("mrr", "recall_at_10", "ndcg_at_10")
        }
    if no_match_hit_counts:
        cohorts["no-match"] = {
            "returned_hit_count": sum(no_match_hit_counts),
            "mean_returned_hits": statistics.mean(no_match_hit_counts),
            "false_positive_rate": sum(
                hit_count > 0 for hit_count in no_match_hit_counts
            )
            / len(no_match_hit_counts),
        }

    end_to_end = [float(result["end_to_end_duration_ms"]) for result in run["results"]]
    return {
        "cohorts": cohorts,
        "false_empty_positive_count": false_empty_positive_count,
        "false_empty_positive_rate": (
            false_empty_positive_count / positive_result_count
            if positive_result_count
            else None
        ),
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
    run: dict[str, Any], cases_by_key: dict[str, dict[str, Any]]
) -> bool:
    for result in run["results"]:
        case = cases_by_key[result["case_key"]]
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


def _selection_blockers(cases_by_key: dict[str, dict[str, Any]]) -> list[str]:
    cases = list(cases_by_key.values())
    positive_cases = [case for case in cases if case["kind"] != "no-match"]
    exploratory = [case for case in cases if case["kind"] == "exploratory"]
    known_item = [case for case in cases if case["kind"] == "known-item"]
    no_match = [case for case in cases if case["kind"] == "no-match"]
    blockers = []
    if len(positive_cases) < MIN_SELECTION_CASES:
        blockers.append(f"at least {MIN_SELECTION_CASES} positive cases are required")
    if len(exploratory) < MIN_SELECTION_EXPLORATORY_CASES:
        blockers.append(
            f"at least {MIN_SELECTION_EXPLORATORY_CASES} exploratory cases are required"
        )
    if len(known_item) < MIN_SELECTION_KNOWN_ITEM_CASES:
        blockers.append(
            f"at least {MIN_SELECTION_KNOWN_ITEM_CASES} known-item cases are required"
        )
    if not no_match:
        blockers.append("at least one no-match case is required")
    under_judged = sorted(
        case["query"]
        for case in exploratory
        if len(case["judgments"]) < MIN_EXPLORATORY_JUDGMENTS
    )
    if under_judged:
        blockers.append(
            "exploratory cases need at least "
            f"{MIN_EXPLORATORY_JUDGMENTS} judgments: {', '.join(under_judged)}"
        )
    return blockers


def _select_production(
    runs: list[dict[str, Any]], cases_by_key: dict[str, dict[str, Any]]
) -> dict[str, Any] | None:
    if _selection_blockers(cases_by_key):
        return None
    lexical_current = next(run for run in runs if run["mode"] == "lexical-current")
    baseline = lexical_current["metrics"]
    candidates = []
    for run in runs:
        if run["mode"] != "hybrid":
            continue
        metrics = run["metrics"]
        if metrics["cohorts"]["no-match"]["false_positive_rate"] != 0:
            continue
        if not _known_item_rank_one(run, cases_by_key):
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
            run["ranking_score_threshold"] or 0,
            run["metrics"]["latency_ms"]["end_to_end_p95"] or float("inf"),
        ),
    )
    return {
        "dimensions": selected["dimensions"],
        "semantic_ratio": selected["semantic_ratio"],
        "ranking_score_threshold": selected["ranking_score_threshold"],
        "mode": selected["mode"],
    }


def _pool_top_twenty(runs: list[dict[str, Any]]) -> dict[str, list[str]]:
    pooled: dict[str, list[str]] = {}
    for run in runs:
        for result in run["results"]:
            app_ids = pooled.setdefault(result["case_key"], [])
            for app_id in result["ranked_app_ids"][:20]:
                if app_id not in app_ids:
                    app_ids.append(app_id)
    return pooled


def evaluate(args: argparse.Namespace) -> dict[str, Any]:
    if not args.work_index.startswith("apps-search-eval-"):
        raise ValueError("--work-index must start with apps-search-eval-")

    cases = _validate_cases(json.loads(Path(args.cases).read_text()))
    cases_by_key = {_case_key(case): case for case in cases}
    if len(cases_by_key) != len(cases):
        raise ValueError("case query, locale, and filters must be unique")
    ranking_score_thresholds = args.ranking_score_thresholds or [None]
    if any(
        threshold is not None and not 0 <= threshold <= 1
        for threshold in ranking_score_thresholds
    ):
        raise ValueError("ranking score thresholds must be between 0 and 1")
    evaluation_dimensions = list(
        dict.fromkeys([config.settings.search_embedding_dimensions, *args.dimensions])
    )
    evaluation_semantic_ratios = list(
        dict.fromkeys(
            [config.settings.search_hybrid_semantic_ratio, *args.semantic_ratios]
        )
    )

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
        run["metrics"] = _metrics_for_run(run, cases_by_key)
        runs.append(run)

    _set_ranking_rules(client, args.work_index, CURRENT_RANKING_RULES)

    for dimensions in evaluation_dimensions:
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
        for semantic_ratio in evaluation_semantic_ratios:
            for ranking_score_threshold in ranking_score_thresholds:
                run = _run_queries(
                    client,
                    args.work_index,
                    cases,
                    "hybrid",
                    semantic_ratio=semantic_ratio,
                    embedder=config.settings.search_hybrid_embedder,
                    ranking_score_threshold=ranking_score_threshold,
                )
                run["dimensions"] = dimensions
                run["semantic_ratio"] = semantic_ratio
                run["ranking_score_threshold"] = ranking_score_threshold
                run["embedding_duration_ms"] = embedding_duration_ms
                run["embedding_task_status"] = task_result.status
                run["database_growth_bytes"] = (
                    current_database_size - work_database_size
                    if isinstance(current_database_size, (int, float))
                    and isinstance(work_database_size, (int, float))
                    else None
                )
                run["fireworks_tokens"] = None
                run["metrics"] = _metrics_for_run(run, cases_by_key)
                runs.append(run)
    selection_blockers = _selection_blockers(cases_by_key)
    return {
        "source_index": args.source_index,
        "work_index": args.work_index,
        "dimensions": evaluation_dimensions,
        "semantic_ratios": evaluation_semantic_ratios,
        "ranking_score_thresholds": ranking_score_thresholds,
        "pooled_top_twenty": _pool_top_twenty(runs),
        "selection_blockers": selection_blockers,
        "runs": runs,
        "selected_production": (
            None if selection_blockers else _select_production(runs, cases_by_key)
        ),
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
    parser.add_argument(
        "--ranking-score-thresholds", action="append", type=float, default=[]
    )
    parser.add_argument("--output", required=True)
    return parser


def main() -> None:
    args = build_parser().parse_args()
    output = evaluate(args)
    Path(args.output).write_text(json.dumps(output, indent=2) + "\n")


if __name__ == "__main__":
    main()
