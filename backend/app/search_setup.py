import logging
import time
from typing import Any

import meilisearch
import meilisearch.errors

from . import config, search_health
from .search_index import configure_index

logger = logging.getLogger(__name__)

DEFAULT_SOURCE_INDEX = "apps"
DEFAULT_TARGET_INDEX = "apps-hybrid"
EMBEDDER_NAME = "apps-fireworks-qwen3"
DOCUMENT_TEMPLATE = '{% if doc.name %}{{ doc.name }}{% if doc.developer_name %} by {{ doc.developer_name }}{% endif %}{% if doc.main_categories %}. Category: {{ doc.main_categories }}{% endif %}{% if doc.sub_categories %}, {{ doc.sub_categories | join: ", " }}{% endif %}{% if doc.keywords %}. Keywords: {{ doc.keywords | join: ", " | truncatewords: 12 }}{% endif %}{% if doc.summary %}. {{ doc.summary }}{% endif %}{% if doc.description %}. {{ doc.description | truncatewords: 40 }}{% endif %}{% else %}Non-interactive Flathub metadata record{% endif %}'

client = meilisearch.Client(
    config.settings.meilisearch_url, config.settings.meilisearch_key
)


def build_embedder_settings(
    settings: config.Settings, dimensions: int | None = None
) -> dict[str, dict[str, Any]]:
    selected_dimensions = (
        dimensions if dimensions is not None else settings.search_embedding_dimensions
    )
    if not 32 <= selected_dimensions <= 4096:
        raise ValueError("embedding dimensions must be between 32 and 4096")
    return {
        settings.search_hybrid_embedder: {
            "source": "rest",
            "url": settings.search_embedding_url,
            "apiKey": settings.fireworks_api_key,
            "dimensions": selected_dimensions,
            "request": {
                "model": settings.search_embedding_model,
                "input": ["{{text}}", "{{..}}"],
                "dimensions": selected_dimensions,
                "encoding_format": "float",
                "normalize": True,
            },
            "response": {"data": [{"embedding": "{{embedding}}"}, "{{..}}"]},
            "documentTemplate": DOCUMENT_TEMPLATE,
            "documentTemplateMaxBytes": 2000,
        }
    }


def _task_error_code(result: Any) -> str | None:
    error = getattr(result, "error", None)
    if isinstance(error, dict):
        code = error.get("code")
    else:
        code = getattr(error, "code", None)
    return code if isinstance(code, str) else None


def _wait_for_task_uid(
    task_uid: int, allowed_error_codes: frozenset[str] = frozenset()
) -> Any:
    result = client.wait_for_task(
        task_uid, timeout_in_ms=1_800_000, interval_in_ms=1_000
    )
    error_code = _task_error_code(result)
    if result.status != "succeeded" and error_code not in allowed_error_codes:
        detail = f": {error_code}" if error_code else ""
        raise RuntimeError(
            f"Meilisearch task {task_uid} ended with {result.status}{detail}"
        )
    return result


def _wait_for_task(task: Any, allowed_error_codes: frozenset[str] = frozenset()) -> Any:
    return _wait_for_task_uid(task.task_uid, allowed_error_codes)


def _wait_for_task_barrier(task_uid: int) -> None:
    client.wait_for_task(
        task_uid,
        timeout_in_ms=1_800_000,
        interval_in_ms=1_000,
    )


def ensure_hybrid_index(index_uid: str = DEFAULT_TARGET_INDEX) -> None:
    try:
        task = client.create_index(index_uid, {"primaryKey": "id"})
    except meilisearch.errors.MeilisearchApiError as error:
        if getattr(error, "code", None) != "index_already_exists":
            raise
    else:
        _wait_for_task(task, frozenset({"index_already_exists"}))

    index = client.index(index_uid)
    for task in configure_index(index):
        _wait_for_task(task)


def _embedded_document_count(index_uid: str) -> int | None:
    http = getattr(client, "http", None)
    if http is None:
        return None
    stats = http.get(f"/indexes/{index_uid}/stats")
    return stats.get("numberOfEmbeddedDocuments")


def _document_count(index: Any) -> int:
    stats = index.get_stats()
    return stats.number_of_documents


def verify_embedding_coverage(index_uid: str = DEFAULT_TARGET_INDEX) -> None:
    document_count = _document_count(client.index(index_uid))
    embedded_count = _embedded_document_count(index_uid)
    if embedded_count is None:
        raise RuntimeError("Meilisearch embedding coverage is unavailable")
    if embedded_count != document_count:
        raise RuntimeError(
            f"Hybrid index embedding count mismatch: {embedded_count} != {document_count}"
        )
    logger.info(
        "Hybrid index embedding coverage verified: index=%s documents=%d embedded=%d",
        index_uid,
        document_count,
        embedded_count,
    )


def backfill_hybrid_index(
    source_uid: str = DEFAULT_SOURCE_INDEX, target_uid: str = DEFAULT_TARGET_INDEX
) -> None:
    source_index = client.index(source_uid)
    target_index = client.index(target_uid)
    offset = 0

    while True:
        documents_page = source_index.get_documents({"offset": offset, "limit": 1000})
        documents = [dict(document) for document in documents_page.results]
        if not documents:
            break

        task = target_index.update_documents(documents)
        _wait_for_task(task)
        offset += len(documents)
        if offset >= documents_page.total:
            break

    source_count = _document_count(source_index)
    target_count = _document_count(target_index)
    logger.info(
        "Hybrid index backfill complete: source=%s target=%s source_documents=%d target_documents=%d",
        source_uid,
        target_uid,
        source_count,
        target_count,
    )
    if source_count != target_count:
        raise RuntimeError(
            f"Hybrid index document count mismatch: {source_count} != {target_count}"
        )


def reconcile_hybrid_index(
    source_uid: str = DEFAULT_SOURCE_INDEX, target_uid: str = DEFAULT_TARGET_INDEX
) -> None:
    ensure_hybrid_index(target_uid)
    with search_health.hybrid_mutation_lock():
        start_generation, lexical_task_uid = search_health.get_lexical_mutation_state()

    if lexical_task_uid is not None:
        _wait_for_task_barrier(lexical_task_uid)

    delete_task = client.index(target_uid).delete_all_documents()
    _wait_for_task(delete_task)
    configure_hybrid_embedder(target_uid)
    backfill_hybrid_index(source_uid, target_uid)
    verify_embedding_coverage(target_uid)

    with search_health.hybrid_mutation_lock():
        end_generation, _ = search_health.get_lexical_mutation_state()
        if end_generation != start_generation:
            raise RuntimeError(
                "Lexical index mutated during hybrid index reconciliation"
            )
        if not search_health.clear_hybrid_task_failures():
            raise RuntimeError("Unable to clear hybrid index failure state")


def configure_hybrid_embedder(index_uid: str = DEFAULT_TARGET_INDEX) -> None:
    if (
        not config.settings.fireworks_api_key
        or not config.settings.fireworks_api_key.strip()
    ):
        raise ValueError(
            "FIREWORKS_API_KEY is required to configure the hybrid embedder"
        )

    started_at = time.perf_counter()
    task_uid = None
    try:
        task = client.index(index_uid).update_embedders(
            build_embedder_settings(config.settings)
        )
        task_uid = task.task_uid
        result = _wait_for_task(task)
        duration_ms = (time.perf_counter() - started_at) * 1000
        logger.info(
            "Hybrid embedder configuration complete",
            extra={
                "index": index_uid,
                "task": task_uid,
                "duration_ms": duration_ms,
                "status": result.status,
                "embedded_documents": _embedded_document_count(index_uid),
            },
        )
    except Exception:
        duration_ms = (time.perf_counter() - started_at) * 1000
        logger.exception(
            "Hybrid embedder configuration failed",
            extra={
                "index": index_uid,
                "task": task_uid,
                "duration_ms": duration_ms,
                "status": "failed",
                "embedded_documents": None,
            },
        )
        raise


def main() -> None:
    reconcile_hybrid_index()


if __name__ == "__main__":
    main()
