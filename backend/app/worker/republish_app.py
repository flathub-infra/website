import typing as T
from typing import Optional

import dramatiq
import httpx

from .. import utils
from ..config import settings
from ..vending import VendingError


@dramatiq.actor
def republish_app(
    app_id: str, endoflife: Optional[str] = None, endoflife_rebase: Optional[str] = None
):
    if not settings.flat_manager_build_secret or not settings.flat_manager_api:
        return

    repos = ["stable"]

    token = utils.create_flat_manager_token(
        "republish_app", ["republish"], apps=[app_id], repos=repos
    )

    with httpx.Client() as session:
        for repo in repos:
            try:
                payload = {"app": app_id}
                if endoflife:
                    payload["endoflife"] = endoflife
                if endoflife_rebase:
                    payload["endoflife_rebase"] = endoflife_rebase

                response = session.post(
                    f"{settings.flat_manager_api}/api/v1/repo/{repo}/republish",
                    headers={"Authorization": token},
                    json=payload,
                )

                if response.status_code != 200:
                    raise VendingError("republish failed")

            except Exception:
                raise VendingError("republish failed")


@dramatiq.actor
def review_check(
    job_id: int,
    status: T.Literal["Passed"] | T.Literal["Failed"],
    reason: str | None,
    build_id: int | None = None,
):
    token = utils.create_flat_manager_token("review_check", ["reviewcheck"])
    r = httpx.post(
        f"{settings.flat_manager_api}/api/v1/job/{job_id}/check/review",
        json={"new-status": {"status": status, "reason": reason}},
        headers={"Authorization": token},
    )
    r.raise_for_status()

    if status == "Passed" and build_id:
        token = utils.create_flat_manager_token(
            "review_check_publish_approved", ["publish"], repos=["stable"]
        )
        r = httpx.post(
            f"{settings.flat_manager_api}/api/v1/build/{build_id}/publish",
            json={},
            headers={"Authorization": token},
        )
        r.raise_for_status()
