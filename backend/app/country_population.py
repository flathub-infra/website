import json
from functools import cache
from pathlib import Path

from pydantic import BaseModel


class CountryPopulation(BaseModel):
    year: int
    revision: str
    populations: dict[str, int]


@cache
def get_country_population(year: int) -> CountryPopulation | None:
    path = Path(__file__).resolve().parents[1] / "data" / "country_population.json"
    with path.open(encoding="utf-8") as source:
        data = json.load(source)
    populations = data["populations"].get(str(year))
    if populations is None:
        return None
    return CountryPopulation(
        year=year, revision=data["revision"], populations=populations
    )
