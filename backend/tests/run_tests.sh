#!/bin/bash
set -e
set -x

day_in_2024="$(date -u -d "2024-06-01" +"%Y/%m/%d.json")"
day_before_in_2024="$(date -u -d "2024-05-31" +"%Y/%m/%d.json")"
two_days_ago_in_2024="$(date -u -d "2024-05-30" +"%Y/%m/%d.json")"
three_days_ago_in_2024="$(date -u -d "2024-05-29" +"%Y/%m/%d.json")"
two_weeks_ago_in_2024="$(date -u -d "2024-05-18" +"%Y/%m/%d.json")"

today="$(date -u -d "today" +"%Y/%m/%d.json")"
yesterday="$(date -u -d "yesterday" +"%Y/%m/%d.json")"
two_days_ago="$(date -u -d "2 days ago" +"%Y/%m/%d.json")"
three_days_ago="$(date -u -d "3 days ago" +"%Y/%m/%d.json")"
two_weeks_ago="$(date -u -d "2 weeks ago" +"%Y/%m/%d.json")"

rm -rf tests/stats/20*
install -d tests/stats/$(dirname $day_in_2024)
install -d tests/stats/$(dirname $day_before_in_2024)
install -d tests/stats/$(dirname $two_days_ago_in_2024)
install -d tests/stats/$(dirname $three_days_ago_in_2024)
install -d tests/stats/$(dirname $two_weeks_ago_in_2024)
install -d tests/stats/$(dirname $today)
install -d tests/stats/$(dirname $yesterday)
install -d tests/stats/$(dirname $two_days_ago)
install -d tests/stats/$(dirname $three_days_ago)
install -d tests/stats/$(dirname $two_weeks_ago)

cp tests/stats/000-three-days-ago.json tests/stats/$three_days_ago_in_2024
cp tests/stats/001-day-before-yesterday.json tests/stats/$two_days_ago_in_2024
cp tests/stats/002-yesterday.json tests/stats/$day_before_in_2024
cp tests/stats/003-today.json tests/stats/$day_in_2024
cp tests/stats/004-two-weeks-ago.json tests/stats/$two_weeks_ago_in_2024
cp tests/stats/000-three-days-ago.json tests/stats/$three_days_ago
cp tests/stats/001-day-before-yesterday.json tests/stats/$two_days_ago
cp tests/stats/002-yesterday.json tests/stats/$yesterday
cp tests/stats/003-today.json tests/stats/$today
cp tests/stats/004-two-weeks-ago.json tests/stats/$two_weeks_ago

docker compose exec backend python -m pytest -vvvv \
	tests/main.py \
	tests/test_storefront_smoke.py \
	tests/test_year_in_review_smoke.py
