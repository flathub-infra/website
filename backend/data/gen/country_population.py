"""Update the bundled UN population data with Python's standard library.

Run from the repository root:
    python backend/data/gen/country_population.py

The January 2026 Togo correction is a separate download.
"""

import argparse
import csv
import gzip
import hashlib
import io
import json
import zipfile
from decimal import Decimal
from pathlib import Path
from urllib.request import urlopen

BASE_URL = (
    "https://population.un.org/wpp/assets/Excel%20Files/1_Indicator%20(Standard)/"
)
SOURCE_URL = BASE_URL + "CSV_FILES/WPP2024_Demographic_Indicators_Medium.csv.gz"
CORRECTION_URL = BASE_URL + "WPP2024_CSV_files_update.zip"
FIRST_YEAR = 2024
LAST_YEAR = 2030


def read_populations(rows, column):
    populations = {str(year): {} for year in range(FIRST_YEAR, LAST_YEAR + 1)}
    for row in rows:
        year = row["Time"]
        if year not in populations or row["LocTypeName"] != "Country/Area":
            continue
        if row["Variant"] != "Medium":
            raise ValueError("Expected medium-variant projections")
        code = row["ISO2_code"]
        population = Decimal(row[column]) * 1000
        if (
            len(code) != 2
            or not code.isalpha()
            or code != code.upper()
            or not population.is_finite()
            or population <= 0
            or population != population.to_integral_value()
            or code in populations[year]
        ):
            raise ValueError(f"Invalid population record for {code}, {year}")
        populations[year][code] = int(population)
    return populations


def generate(source: bytes, correction: bytes):
    with gzip.GzipFile(fileobj=io.BytesIO(source)) as stream:
        populations = read_populations(
            csv.DictReader(io.TextIOWrapper(stream, encoding="utf-8-sig")),
            "TPopulation1July",
        )
    with (
        zipfile.ZipFile(io.BytesIO(correction)) as archive,
        archive.open("WPP2024_TotalPopulationBySex_Medium_Update.csv") as stream,
    ):
        corrected = read_populations(
            csv.DictReader(io.TextIOWrapper(stream, encoding="utf-8-sig")),
            "PopTotal",
        )
    codes = set(populations[str(FIRST_YEAR)])
    if len(codes) != 237:
        raise ValueError("Unexpected WPP2024 country coverage")
    for year, values in populations.items():
        if set(values) != codes or set(corrected[year]) != {"TG"}:
            raise ValueError(f"Incomplete population data for {year}")
        values.update(corrected[year])
        populations[year] = dict(sorted(values.items()))
    return {
        "revision": "2024 (revision 1)",
        "attribution": "United Nations, Department of Economic and Social Affairs, Population Division (2024). World Population Prospects 2024, Online Edition. With the 19 January 2026 interim update.",
        "license": "https://creativecommons.org/licenses/by/3.0/igo/",
        "reference_date": "July 1",
        "unit": "persons",
        "variant": "Medium",
        "sources": [
            {"url": url, "sha256": hashlib.sha256(data).hexdigest()}
            for url, data in ((SOURCE_URL, source), (CORRECTION_URL, correction))
        ],
        "populations": populations,
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--output",
        type=Path,
        default=Path(__file__).resolve().parents[1] / "country_population.json",
    )
    args = parser.parse_args()
    with urlopen(SOURCE_URL, timeout=120) as response:
        source = response.read()
    with urlopen(CORRECTION_URL, timeout=120) as response:
        correction = response.read()
    result = generate(source, correction)
    temporary = args.output.with_suffix(".json.tmp")
    temporary.write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
    temporary.replace(args.output)


if __name__ == "__main__":
    main()
