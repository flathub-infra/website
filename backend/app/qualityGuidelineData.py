import datetime
import enum
from dataclasses import dataclass
from typing import List

QualityGuidelineCategory = enum.Enum(
    value="QualityGuidelineCategory",
    names=[
        ("quality-guideline-category-general", 1),
        ("quality-guideline-category-app-icon", 2),
        ("quality-guideline-category-app-name", 3),
        ("quality-guideline-category-summary", 4),
    ],
)


@dataclass
class QualityGuideline:
    id: int
    category: QualityGuidelineCategory
    translation_key: str
    url: str
    needed_to_pass_since: datetime.datetime
    read_only: bool = False


guidelines: List[QualityGuideline] = [
    QualityGuideline(
        id=1,
        category=QualityGuidelineCategory["quality-guideline-category-general"],
        translation_key="quality-guideline-general-no-trademark-violations",
        url="https://docs.flathub.org/docs/for-app-authors/appdata-guidelines/quality-guidelines/#no-trademark-violations",
        needed_to_pass_since=datetime.datetime(2023, 9, 1),
    ),
    QualityGuideline(
        id=2,
        category=QualityGuidelineCategory["quality-guideline-category-app-icon"],
        translation_key="quality-guideline-app-icon-size",
        url="https://docs.flathub.org/docs/for-app-authors/appdata-guidelines/quality-guidelines/#icon-size",
        needed_to_pass_since=datetime.datetime(2023, 9, 1),
    ),
    QualityGuideline(
        id=3,
        category=QualityGuidelineCategory["quality-guideline-category-app-icon"],
        translation_key="quality-guideline-app-icon-footprint",
        url="https://docs.flathub.org/docs/for-app-authors/appdata-guidelines/quality-guidelines/#reasonable-footprint",
        needed_to_pass_since=datetime.datetime(2023, 9, 1),
    ),
    QualityGuideline(
        id=4,
        category=QualityGuidelineCategory["quality-guideline-category-app-icon"],
        translation_key="quality-guideline-app-icon-contrast",
        url="https://docs.flathub.org/docs/for-app-authors/appdata-guidelines/quality-guidelines/#good-contrast",
        needed_to_pass_since=datetime.datetime(2023, 9, 1),
    ),
    QualityGuideline(
        id=5,
        category=QualityGuidelineCategory["quality-guideline-category-app-icon"],
        translation_key="quality-guideline-app-icon-detail",
        url="https://docs.flathub.org/docs/for-app-authors/appdata-guidelines/quality-guidelines/#not-too-much-detail",
        needed_to_pass_since=datetime.datetime(2023, 9, 1),
    ),
    QualityGuideline(
        id=6,
        category=QualityGuidelineCategory["quality-guideline-category-app-icon"],
        translation_key="quality-guideline-app-icon-no-baked-in-shadows",
        url="https://docs.flathub.org/docs/for-app-authors/appdata-guidelines/quality-guidelines/#no-baked-in-shadows",
        needed_to_pass_since=datetime.datetime(2023, 9, 1),
    ),
    QualityGuideline(
        id=7,
        category=QualityGuidelineCategory["quality-guideline-category-app-icon"],
        translation_key="quality-guideline-app-icon-in-line-with-contemporary-styles",
        url="https://docs.flathub.org/docs/for-app-authors/appdata-guidelines/quality-guidelines/#in-line-with-contemporary-styles",
        needed_to_pass_since=datetime.datetime(2023, 9, 1),
    ),
    QualityGuideline(
        id=8,
        category=QualityGuidelineCategory["quality-guideline-category-app-name"],
        translation_key="quality-guideline-app-name-not-too-long",
        url="https://docs.flathub.org/docs/for-app-authors/appdata-guidelines/quality-guidelines/#not-too-long",
        needed_to_pass_since=datetime.datetime(2023, 9, 1),
        read_only=True,
    ),
    QualityGuideline(
        id=9,
        category=QualityGuidelineCategory["quality-guideline-category-app-name"],
        translation_key="quality-guideline-app-name-just-the-name",
        url="https://docs.flathub.org/docs/for-app-authors/appdata-guidelines/quality-guidelines/#just-the-name",
        needed_to_pass_since=datetime.datetime(2023, 9, 1),
    ),
    QualityGuideline(
        id=10,
        category=QualityGuidelineCategory["quality-guideline-category-app-name"],
        translation_key="quality-guideline-app-no-weird-formatting",
        url="https://docs.flathub.org/docs/for-app-authors/appdata-guidelines/quality-guidelines/#no-weird-formatting",
        needed_to_pass_since=datetime.datetime(2023, 9, 1),
    ),
    QualityGuideline(
        id=11,
        category=QualityGuidelineCategory["quality-guideline-category-summary"],
        translation_key="quality-guideline-app-summary-not-too-long",
        url="https://docs.flathub.org/docs/for-app-authors/appdata-guidelines/quality-guidelines/#not-too-long-1",
        needed_to_pass_since=datetime.datetime(2023, 9, 1),
        read_only=True,
    ),
    QualityGuideline(
        id=12,
        category=QualityGuidelineCategory["quality-guideline-category-summary"],
        translation_key="quality-guideline-app-summary-not-technical",
        url="https://docs.flathub.org/docs/for-app-authors/appdata-guidelines/quality-guidelines/#not-technical",
        needed_to_pass_since=datetime.datetime(2023, 9, 1),
    ),
    QualityGuideline(
        id=13,
        category=QualityGuidelineCategory["quality-guideline-category-summary"],
        translation_key="quality-guideline-app-summary-no-weird-formatting",
        url="https://docs.flathub.org/docs/for-app-authors/appdata-guidelines/quality-guidelines/#no-weird-formatting-1",
        needed_to_pass_since=datetime.datetime(2023, 9, 1),
    ),
    QualityGuideline(
        id=14,
        category=QualityGuidelineCategory["quality-guideline-category-summary"],
        translation_key="quality-guideline-app-summary-dont-repeat-app-name",
        url="https://docs.flathub.org/docs/for-app-authors/appdata-guidelines/quality-guidelines/#dont-repeat-the-name",
        needed_to_pass_since=datetime.datetime(2023, 9, 1),
    ),
    QualityGuideline(
        id=15,
        category=QualityGuidelineCategory["quality-guideline-category-summary"],
        translation_key="quality-guideline-app-summary-dont-start-with-an-article",
        url="https://docs.flathub.org/docs/for-app-authors/appdata-guidelines/quality-guidelines/#dont-start-with-an-article",
        needed_to_pass_since=datetime.datetime(2023, 9, 1),
    ),
]
