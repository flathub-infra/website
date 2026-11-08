import csv
import gzip
import io
import json
import zipfile
from pathlib import Path

import pytest

from app.country_population import get_country_population
from data.gen.country_population import (
    FIRST_YEAR,
    LAST_YEAR,
    generate,
    read_populations,
)

DATA_PATH = Path(__file__).resolve().parents[1] / "data" / "country_population.json"


def test_bundled_population_coverage_and_togo_correction(monkeypatch, tmp_path):
    monkeypatch.chdir(tmp_path)
    get_country_population.cache_clear()
    data = json.loads(DATA_PATH.read_text())
    assert set(data["populations"]) == {str(year) for year in range(2024, 2031)}
    codes = set(data["populations"][str(FIRST_YEAR)])
    assert len(codes) == 237
    for year in range(FIRST_YEAR, LAST_YEAR + 1):
        population = get_country_population(year)
        assert population is not None
        assert population.year == year
        assert population.revision == "2024 (revision 1)"
        assert set(population.populations) == codes
        assert all(
            type(value) is int and value > 0
            for value in population.populations.values()
        )
    population = get_country_population(2026)
    assert population.populations["TG"] == 8_780_006
    assert population.populations["VA"] == 506
    assert {"TW", "XK", "PS", "EH", "GG", "JE"} <= codes
    assert not {"AX", "EU", "AQ", "SJ"} & codes
    assert get_country_population(2023) is None
    assert get_country_population(2031) is None


def csv_bytes(rows, column):
    stream = io.StringIO()
    writer = csv.DictWriter(
        stream, fieldnames=["Time", "LocTypeName", "ISO2_code", "Variant", column]
    )
    writer.writeheader()
    writer.writerows(rows)
    return stream.getvalue().encode("utf-8-sig")


def test_generator_converts_units_applies_patch_and_checks_coverage():
    codes = json.loads(DATA_PATH.read_text())["populations"][str(FIRST_YEAR)]
    rows = [
        {
            "Time": str(year),
            "LocTypeName": "Country/Area",
            "ISO2_code": code,
            "Variant": "Medium",
            "TPopulation1July": "1.234",
        }
        for year in range(FIRST_YEAR, LAST_YEAR + 2)
        for code in codes
    ]
    corrected = [
        {
            "Time": str(year),
            "LocTypeName": "Country/Area",
            "ISO2_code": "TG",
            "Variant": "Medium",
            "PopTotal": "2.345",
        }
        for year in range(FIRST_YEAR, LAST_YEAR + 2)
    ]
    archive = io.BytesIO()
    with zipfile.ZipFile(archive, "w") as output:
        output.writestr(
            "WPP2024_TotalPopulationBySex_Medium_Update.csv",
            csv_bytes(corrected, "PopTotal"),
        )
    source = gzip.compress(csv_bytes(rows, "TPopulation1July"))
    result = generate(source, archive.getvalue())
    assert set(result["populations"]) == {str(year) for year in range(2024, 2031)}
    assert result["populations"]["2026"]["US"] == 1234
    assert result["populations"]["2026"]["TG"] == 2345
    assert len(result["sources"]) == 2
    with pytest.raises(ValueError, match="coverage"):
        generate(
            gzip.compress(csv_bytes(rows[1:], "TPopulation1July")), archive.getvalue()
        )


@pytest.mark.parametrize("value", ["", "0", "-1", "NaN", "Infinity", "0.0001"])
def test_generator_rejects_invalid_populations(value):
    rows = [
        {
            "Time": "2026",
            "LocTypeName": "Country/Area",
            "ISO2_code": "US",
            "Variant": "Medium",
            "PopTotal": value,
        }
    ]
    with pytest.raises((ValueError, ArithmeticError)):
        read_populations(rows, "PopTotal")
