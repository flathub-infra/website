import logging
import time
from typing import Any, cast

import dramatiq
import httpx
from sqlalchemy import Table, func, update

from .. import config, http_client, models
from ..database import get_db
from ..dramatiq_broker import broker

logger = logging.getLogger(__name__)

JEV_PROVIDER = "typesafe"
JEV_API_URL = "https://api.typesafe.ai/v1/systemone"
QUESTION_SCHEMA_VERSION = 1
QUESTIONS = {
    "custom_build_logic": (
        "Does the candidate introduce or materially change custom build commands, "
        "scripts, or patches, beyond version or dependency checksum updates?"
    ),
    "mechanical_refresh": (
        "Is the change primarily mechanically generated dependency-source refresh "
        "while the packaging procedure stays substantially the same?"
    ),
    "dependency_supply": (
        "Does the candidate materially change how dependencies are built, "
        "installed, bundled, or supplied by the runtime?"
    ),
    "runtime_integration": (
        "Does the candidate materially change runtime or SDK integration, beyond "
        "replacing a runtime version with an equivalent newer version?"
    ),
    "architecture_behavior": (
        "Does the candidate materially change architecture-specific build behavior?"
    ),
    "packaging_procedure": (
        "Does the candidate materially change the procedure that assembles the "
        "application package, rather than only updating dependency versions or "
        "removing unused build modules?"
    ),
}


def _probability(answer: dict[str, Any]) -> float:
    value = answer["noul"]
    if (
        answer["type"] != "noul"
        or isinstance(value, bool)
        or not isinstance(value, int | float)
        or not 0.0 <= value <= 1.0
    ):
        raise ValueError(f"Invalid Jev answer: {answer!r}")
    return float(value)


def call_jev(state: dict[str, Any]) -> dict[str, Any]:
    started = time.monotonic()
    outcome: dict[str, Any]
    try:
        response = http_client.post(
            JEV_API_URL,
            headers={"Authorization": f"Bearer {config.settings.typesafe_api_key}"},
            json={
                "model": config.settings.typesafe_jev_model,
                "state": state,
                "questions": {
                    key: {"type": "noul", "instructions": question}
                    for key, question in QUESTIONS.items()
                },
            },
            timeout=config.settings.ostree_manifest_jev_timeout_seconds,
        )
        response.raise_for_status()
        answers = response.json()["answers"]
        probabilities = {key: _probability(answers[key]) for key in QUESTIONS}
    except httpx.TimeoutException:
        outcome = {"status": "timeout", "probabilities": None}
    except httpx.HTTPStatusError as exc:
        outcome = {
            "status": "http_error",
            "http_status": exc.response.status_code,
            "probabilities": None,
        }
    except Exception as exc:
        logger.warning("Jev request failed", exc_info=True)
        outcome = {
            "status": "error",
            "error": type(exc).__name__,
            "probabilities": None,
        }
    else:
        outcome = {"status": "success", "probabilities": probabilities}
    outcome["latency_ms"] = round((time.monotonic() - started) * 1000)
    return outcome


@dramatiq.actor(broker=broker, max_retries=0, time_limit=60_000)
def observe_manifest_semantics(
    build_id: int,
    app_id: str,
    state: dict[str, Any],
    pending: dict[str, Any],
) -> None:
    try:
        outcome = call_jev(state)
        payload = {**pending, **outcome}
        table = cast("Table", models.ManifestAnalysisObservation.__table__)
        with get_db("writer") as db:
            db.session.execute(
                update(table)
                .where(
                    table.c.build_id == build_id,
                    table.c.app_id == app_id,
                    table.c.jev_semantic_analysis["state_hash"].astext
                    == pending["state_hash"],
                )
                .values(jev_semantic_analysis=payload, updated_at=func.now())
            )
        logger.info(
            "Recorded Jev semantic observation for app",
            extra={
                "build_id": build_id,
                "app_id": app_id,
                "state_hash": pending["state_hash"],
                "jev_status": payload["status"],
                "latency_ms": payload.get("latency_ms"),
            },
        )
    except Exception:
        logger.exception(
            "Failed to record Jev semantic observation for %s in build %s",
            app_id,
            build_id,
        )
