import os
import sys

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.append(ROOT_DIR)

from app.api_models import Screenshot, SummaryResponse


def test_summary_response_allows_architecture_only_entries():
    response = SummaryResponse(arches=["aarch64"], branch="stable")

    assert response.model_dump(by_alias=True, exclude_none=True) == {
        "arches": ["aarch64"],
        "branch": "stable",
    }


def test_screenshot_preserves_environment():
    screenshot = Screenshot(
        sizes=[{"width": "800", "height": "600", "src": "screenshot.png"}],
        environment="dark",
    )

    assert screenshot.model_dump(exclude_none=True) == {
        "sizes": [
            {
                "width": "800",
                "height": "600",
                "scale": "1x",
                "src": "screenshot.png",
            }
        ],
        "environment": "dark",
    }
