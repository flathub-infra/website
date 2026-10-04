import os
import sys

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.append(ROOT_DIR)

from app.api_models import SummaryResponse


def test_summary_response_allows_architecture_only_entries():
    response = SummaryResponse(arches=["aarch64"], branch="stable")

    assert response.model_dump(by_alias=True, exclude_none=True) == {
        "arches": ["aarch64"],
        "branch": "stable",
    }
