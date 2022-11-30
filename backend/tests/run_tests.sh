#/bin/bash
set -x

today="$(date -d "today" +"%Y/%m/%d.json")"
yesterday="$(date -d "yesterday" +"%Y/%m/%d.json")"
two_days_ago="$(date -d "2 days ago" +"%Y/%m/%d.json")"

rm -rf tests/stats/20.*
install -d tests/stats/$(dirname $today)
install -d tests/stats/$(dirname $yesterday)
cp tests/stats/001-day-before-yesterday.json tests/stats/$two_days_ago
cp tests/stats/002-yesterday.json tests/stats/$yesterday
cp tests/stats/003-today.json tests/stats/$today

for container in backend worker; do
    docker compose exec $container flatpak --user remote-delete flathub
    docker compose exec $container flatpak --user remote-delete flathub-beta
    docker compose exec $container flatpak --user remote-add flathub --no-gpg-verify /app/tests/ostree/repo
    docker compose exec $container flatpak --user update
done

docker compose exec backend pip3 install pytest
docker compose exec backend python3 -m pytest -vvvv tests/main.py
