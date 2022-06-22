import datetime
import glob
import json
import os
import shutil
import sys
import tempfile

import gi
import pytest

gi.require_version("OSTree", "1.0")

from urllib import parse

import vcr
from fastapi.testclient import TestClient
from gi.repository import Gio, OSTree
from lxml import etree

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.append(ROOT_DIR)

workspace = None


vcr = vcr.VCR(cassette_library_dir="tests/cassettes")


def _get_expected_json_result(test_name):
    path = os.path.join("tests", "results", f"{test_name}.json")
    with open(path) as result:
        return json.load(result)


def _get_expected_xml_result(test_name):
    path = os.path.join("tests", "results", f"{test_name}.xml")
    with open(path) as result:
        return etree.fromstring(result.read().encode("utf-8"))


def _get_expected_text_result(test_name):
    path = os.path.join("tests", "results", f"{test_name}.txt")
    with open(path) as result:
        return result.read()


def setup_module():
    global workspace

    workspace = tempfile.TemporaryDirectory()

    installation_path = os.path.join(workspace.name, "flatpak")
    repo_path = os.path.join(installation_path, "repo")

    os.mkdir(installation_path)
    os.environ["FLATPAK_USER_DIR"] = installation_path

    file = Gio.File.new_for_path(repo_path)
    repo = OSTree.Repo.new(file)
    repo.create(OSTree.RepoMode.BARE, None)
    remote_path = os.path.join(os.getcwd(), "tests/ostree/repo")
    repo.remote_add("flathub", f"file://{remote_path}")

    for i, test_stats_json in enumerate(
        sorted(glob.glob("tests/stats/*.json"), reverse=True)
    ):
        date = datetime.date.today() - datetime.timedelta(days=i)
        stats_file = os.path.join(workspace.name, date.strftime("%Y/%m/%d.json"))
        os.makedirs(os.path.dirname(stats_file), exist_ok=True)
        print(f"Copy {test_stats_json} to {stats_file}")
        shutil.copy(test_stats_json, stats_file)

    from app import config

    config.settings.appstream_repos = "tests/appstream"
    config.settings.datadir = "tests/data"
    config.settings.stats_baseurl = "file://" + workspace.name


@pytest.fixture
def client():

    from app import main

    with TestClient(main.app) as client_:
        yield client_


def teardown_module():
    workspace.cleanup()


def test_update(client):
    response = client.post("/update")
    assert response.status_code == 200


def test_apps_by_category(client):
    response = client.get("/category/Game")
    assert response.status_code == 200
    assert response.json() == _get_expected_json_result("test_apps_by_category")


def test_apps_by_category(client):
    response = client.get("/category/Game?page=1&per_page=10")
    assert response.status_code == 200


def test_apps_by_non_existent_category(client):
    response = client.get("/category/NonExistent")
    assert response.status_code == 422


def test_apps_by_category_with_too_few_page_params(client):
    response = client.get("/category/Game?page=2")
    assert response.status_code == 400


def test_apps_by_category_with_too_few_per_page_params(client):
    response = client.get("/category/Game?per_page=20")
    assert response.status_code == 400


def test_apps_by_developer(client):
    response = client.get("/developer/Sugar Labs Community")
    assert response.status_code == 200
    assert response.json() == _get_expected_json_result("test_apps_by_developer")


def test_apps_by_non_existent_developer(client):
    response = client.get("/developer/NonExistent")
    assert response.status_code == 404


def test_apps_by_projectgroup(client):
    response = client.get("/projectgroup")
    assert response.status_code == 200
    assert response.json() == _get_expected_json_result("test_list_projectgroups")


def test_apps_by_projectgroup(client):
    response = client.get("/projectgroup/SugarLabs")
    assert response.status_code == 200
    assert response.json() == _get_expected_json_result("test_apps_by_projectgroup")


def test_apps_by_non_existent_project_group(client):
    response = client.get("/projectgroup/NonExistent")
    assert response.status_code == 404


def test_appstream_by_appid(client):
    response = client.get("/appstream/org.sugarlabs.Maze")
    assert response.status_code == 200
    assert response.json() == _get_expected_json_result("test_appstream_by_appid")


def test_appstream_by_non_existent_appid(client):
    response = client.get("/appstream/NonExistent")
    assert response.status_code == 404
    assert response.json() == None


def test_search_query_by_partial_name(client):
    response = client.get("/search/maz")
    assert response.status_code == 200
    assert response.json() == _get_expected_json_result("test_search_query_by_appid")


def test_search_query_by_partial_name_2(client):
    response = client.get("/search/ma")
    assert response.status_code == 200
    assert response.json() == _get_expected_json_result("test_search_query_by_appid")


def test_search_query_by_name(client):
    response = client.get("/search/Maze")
    assert response.status_code == 200
    assert response.json() == _get_expected_json_result("test_search_query_by_appid")


def test_search_query_by_summary(client):
    response = client.get("/search/maze%20game")
    assert response.status_code == 200
    assert response.json() == _get_expected_json_result("test_search_query_by_appid")


def test_search_query_by_description(client):
    response = client.get("/search/finding%20your%20way%20out")
    assert response.status_code == 200
    assert response.json() == _get_expected_json_result("test_search_query_by_appid")


def test_search_query_by_non_existent(client):
    response = client.get("/search/NonExistent")
    assert response.status_code == 200
    assert response.json() == _get_expected_json_result(
        "test_search_query_by_non_existent"
    )


def test_collection_by_recently_updated(client):
    response = client.get("/collection/recently-updated")
    assert response.status_code == 200
    assert response.json() == _get_expected_json_result(
        "test_collection_by_recently_updated"
    )


def test_collection_by_one_recently_updated(client):
    response = client.get("/collection/recently-updated/1")
    assert response.status_code == 200
    assert response.json() == _get_expected_json_result(
        "test_collection_by_one_recently_updated"
    )


def test_feed_by_recently_updated(client):
    response = client.get("/feed/recently-updated")
    assert response.status_code == 200

    feed = etree.fromstring(response.text.encode("utf-8"))
    expected = _get_expected_xml_result("test_feed_by_recently_updated")

    # Remove runtime-generated dates
    for component in [feed, expected]:
        channel = component.find("channel")

        date = channel.find("lastBuildDate")
        channel.remove(date)

        title = channel.find("title")
        channel.remove(title)

    assert etree.tostring(feed) == etree.tostring(expected)


def test_feed_by_new(client):
    response = client.get("/feed/new")
    assert response.status_code == 200

    feed = etree.fromstring(response.text.encode("utf-8"))
    expected = _get_expected_xml_result("test_feed_by_new")

    # Remove runtime-generated date and title because encoding is hard
    for component in [feed, expected]:
        channel = component.find("channel")

        date = channel.find("lastBuildDate")
        channel.remove(date)

        title = channel.find("title")
        channel.remove(title)

    assert etree.tostring(feed) == etree.tostring(expected)


def test_picked_apps(client):
    response = client.get("/picks/apps")
    assert response.status_code == 200


def test_picked_games(client):
    response = client.get("/picks/games")
    assert response.status_code == 200


def test_picked_non_existent(client):
    response = client.get("/picks/NonExistent")
    assert response.status_code == 404
    assert response.json() == None


def test_popular(client):
    response = client.get("/popular")
    assert response.status_code == 200
    assert response.json() == _get_expected_json_result("test_popular")


def test_status(client):
    response = client.get("/status")
    assert response.status_code == 200
    assert response.json() == _get_expected_json_result("test_status")


def test_list_appstream(client):
    response = client.get("/appstream")
    assert response.status_code == 200
    assert response.json() == _get_expected_json_result("test_list_appstream")


def test_summary_by_id(client):
    response = client.get("/summary/org.sugarlabs.Maze")
    assert response.status_code == 200
    assert response.json() == _get_expected_json_result("test_summary_by_appid")


def test_summary_by_non_existent_id(client):
    response = client.get("/summary/does.not.exist")
    assert response.status_code == 404
    assert response.json() == None


def test_stats(client):
    response = client.get("/stats")
    today = datetime.date.today()
    yesterday = today - datetime.timedelta(days=1)
    day_before_yesterday = today - datetime.timedelta(days=2)
    expected = {
        "countries": {"AD": 30, "BR": 60},
        "downloads_per_day": {},
        "delta_downloads_per_day": {},
        "updates_per_day": {},
        "downloads": 3486,
        "number_of_apps": 3,
    }
    expected["delta_downloads_per_day"][day_before_yesterday.isoformat()] = 15
    expected["delta_downloads_per_day"][yesterday.isoformat()] = 15
    expected["delta_downloads_per_day"][today.isoformat()] = 15
    expected["downloads_per_day"][day_before_yesterday.isoformat()] = 703
    expected["downloads_per_day"][yesterday.isoformat()] = 1964
    expected["downloads_per_day"][today.isoformat()] = 819
    expected["updates_per_day"][day_before_yesterday.isoformat()] = 5
    expected["updates_per_day"][yesterday.isoformat()] = 5
    expected["updates_per_day"][today.isoformat()] = 5

    assert response.status_code == 200
    assert response.json() == expected


def test_app_stats_by_id(client):
    response = client.get("/stats/org.sugarlabs.Maze")

    today = datetime.date.today()
    day_before_yesterday = today - datetime.timedelta(days=2)
    expected = {
        "installs_total": 7,
        "installs_per_day": {day_before_yesterday.isoformat(): 6},
        "installs_last_month": 7,
        "installs_last_7_days": 7,
    }

    assert response.status_code == 200
    assert response.json() == expected


def test_app_stats_by_non_existent_id(client):
    response = client.get("/stats/does.not.exist")
    assert response.status_code == 404
    assert response.json() == None


def test_sitemap_text(client):
    response = client.get("/sitemap/text")
    assert response.status_code == 200
    assert response.text == _get_expected_text_result("test_sitemap_text")


def test_compat_apps(client):
    response = client.get("/compat/apps")
    assert response.status_code == 200

    response_json = response.json()
    for app in response_json:
        del app["inStoreSinceDate"]

    expected_json = _get_expected_json_result("test_compat_apps")
    for app in expected_json:
        del app["inStoreSinceDate"]

    assert response_json == expected_json


def test_compat_apps_category(client):
    response = client.get("/compat/apps/category/Network")
    assert response.status_code == 200
    assert response.json() == _get_expected_json_result("test_compat_apps_category")


def test_compat_apps_by_appid(client):
    response = client.get("/compat/apps/org.sugarlabs.Maze")
    assert response.status_code == 200

    response_json = response.json()
    del response_json["inStoreSinceDate"]

    expected_json = _get_expected_json_result("test_compat_apps_by_appid")
    del expected_json["inStoreSinceDate"]

    assert response_json == expected_json


def test_compat_apps_search(client):
    response = client.get("/compat/apps/search/Maze")
    assert response.status_code == 200
    assert response.json() == _get_expected_json_result("test_compat_apps_search")


def test_compat_apps_recently_updated(client):
    response = client.get("/compat/apps/collection/recently-updated/50")
    assert response.status_code == 200

    response_json = response.json()
    for app in response_json:
        del app["inStoreSinceDate"]

    expected_json = _get_expected_json_result("test_compat_apps_recently_updated")
    for app in expected_json:
        del app["inStoreSinceDate"]

    assert response_json == expected_json


@vcr.use_cassette()
def test_verification_status(client):
    response = client.get("/verification/com.github.flathub.ExampleApp/status")
    expected = {
        "verified": False,
        "method": "none",
        "detail": "repo_does_not_exist",
    }
    assert response.status_code == 200
    assert response.json() == expected


@vcr.use_cassette()
def test_verification_available_method_website(client):
    response = client.get("/verification/org.gnome.Maps/available-methods")
    expected = {
        "methods": [
            {
                "method": "website",
                "website": "gnome.org",
            }
        ]
    }
    assert response.status_code == 200
    assert response.json() == expected


@vcr.use_cassette()
def test_verification_available_method_github(client):
    response = client.get(
        "/verification/com.github.bilelmoussaoui.Authenticator/available-methods"
    )
    expected = {
        "methods": [
            {
                "method": "login_provider",
                "login_provider": "GitHub",
                "login_name": "bilelmoussaoui",
            }
        ]
    }
    assert response.status_code == 200
    assert response.json() == expected


@vcr.use_cassette()
def test_verification_available_method_multiple(client):
    response = client.get("/verification/io.github.lainsce.Notejot/available-methods")
    expected = {
        "methods": [
            {
                "method": "website",
                "website": "lainsce.github.io",
            },
            {
                "method": "login_provider",
                "login_provider": "GitHub",
                "login_name": "lainsce",
            },
        ]
    }
    assert response.status_code == 200
    assert response.json() == expected


@vcr.use_cassette()
def test_verification_status_dne(client):
    response = client.get("/verification/com.github.flathub.ExampleApp/status")
    expected = {
        "verified": False,
        "method": "none",
        "detail": "repo_does_not_exist",
    }
    assert response.status_code == 200
    assert response.json() == expected


@vcr.use_cassette()
def test_verification_status_invalid(client):
    response = client.get("/verification/com.github/status")
    expected = {
        "verified": False,
        "method": "none",
        "detail": "malformed_app_id",
    }
    assert response.status_code == 200
    assert response.json() == expected


@vcr.use_cassette()
def test_verification_status_website(client):
    response = client.get("/verification/org.gnome.Maps/status")
    expected = {
        "verified": True,
        "method": "website",
        "website": "gnome.org",
    }
    assert response.status_code == 200
    assert response.json() == expected


@vcr.use_cassette()
def test_verification_status_not_verified(client):
    response = client.get("/verification/org.gnome.Calendar/status")
    expected = {
        "verified": False,
        "method": "none",
    }
    assert response.status_code == 200
    assert response.json() == expected


@vcr.use_cassette(record_mode="once")
def test_auth_login_github(client):
    response = client.get("/auth/login/github")
    assert response.status_code == 200
    out = response.json()
    assert out["state"] == "ok"
    state = dict(parse.parse_qsl(parse.urlparse(out["redirect"]).query))["state"]
    print(state)
    post_body = {"code": "d57f9d32d58f76dfcce7", "state": state}
    response = client.post(
        "/auth/login/github", json=post_body, cookies=response.cookies
    )
    assert response.status_code == 200


@vcr.use_cassette(record_mode="once")
def test_auth_login_gitlab(client):
    response = client.get("/auth/login/gitlab")
    assert response.status_code == 200
    out = response.json()
    assert out["state"] == "ok"
    state = dict(parse.parse_qsl(parse.urlparse(out["redirect"]).query))["state"]
    print(state)
    post_body = {
        "code": "af2cd03cdcc616e01969a7975b0ae780bd25125348c03f7e3803b6b166e1c8bd",
        "state": state,
    }
    response = client.post(
        "/auth/login/gitlab", json=post_body, cookies=response.cookies
    )
    assert response.status_code == 200


@vcr.use_cassette(record_mode="once")
def test_auth_login_google(client):
    response = client.get("/auth/login/google")
    assert response.status_code == 200
    out = response.json()
    assert out["state"] == "ok"
    state = dict(parse.parse_qsl(parse.urlparse(out["redirect"]).query))["state"]
    print(state)
    encodedStr = (
        "4%2F0AX4XfWh9fGMl1g5n_RisJiN5qV2tVUnC6d3lDoWJn-1kyQ5f2FsGkyy_cFnsQFmOU2jllg"
    )
    code = parse.unquote(encodedStr)
    post_body = {
        "code": code,
        "state": state,
    }
    response = client.post(
        "/auth/login/google", json=post_body, cookies=response.cookies
    )
    assert response.status_code == 200


@vcr.use_cassette(record_mode="once")
def test_fakewallet(client):
    from app import config

    if config.settings.stripe_public_key:
        pytest.skip("Stripe is configured")
    # Complete a login through Github
    response = client.get("/auth/login/github")
    assert response.status_code == 200
    out = response.json()
    assert out["state"] == "ok"
    state = dict(parse.parse_qsl(parse.urlparse(out["redirect"]).query))["state"]
    print(state)
    post_body = {"code": "04f6dff87ead3551df1d", "state": state}
    response = client.post(
        "/auth/login/github", json=post_body, cookies=response.cookies
    )
    assert response.status_code == 200

    # Test the login was success through `auth/userinfo`
    response = client.get("/auth/userinfo")
    assert response.status_code == 200
    out = response.json()
    assert out["displayname"] == "Adam"

    # List the transactions and check the two default fakewallet ones exist
    response = client.get("/wallet/transactions?sort=recent&limit=100")
    assert response.status_code == 200
    out = response.json()
    assert out[0]["id"] == "12"
    assert out[1]["id"] == "45"

    # List a specific transactions by its ID
    response = client.get("/wallet/transactions/45")
    assert response.status_code == 200
    out = response.json()
    assert out["summary"]["value"] == 1000
    assert out["card"]["last4"] == "1234"
    assert out["details"][0]["recipient"] == "org.flathub.Flathub"

    # List a card inside the fakewallet
    response = client.get("/wallet/walletinfo")
    assert response.status_code == 200
    out = response.json()
    assert out["status"] == "ok"
    assert out["cards"][0]["id"] == "fake_card_exp"
    assert out["cards"][1]["id"] == "fake_card_ok"


@vcr.use_cassette(record_mode="once")
def test_stripewallet(client):
    from app import config

    if not config.settings.stripe_public_key:
        pytest.skip("Stripe is not configured")
    # Test that our Stripe data works correctly
    response = client.get("/wallet/stripedata")
    assert response.status_code == 200
    out = response.json()
    assert out["status"] == "ok"

    # Complete a login through Github
    response = client.get("/auth/login/github")
    assert response.status_code == 200
    out = response.json()
    assert out["state"] == "ok"
    state = dict(parse.parse_qsl(parse.urlparse(out["redirect"]).query))["state"]
    post_body = {"code": "7dcfd37f6ea1f0d87216", "state": state}
    response = client.post(
        "/auth/login/github", json=post_body, cookies=response.cookies
    )
    assert response.status_code == 200

    # Test the login was success through `auth/userinfo`
    response = client.get("/auth/userinfo")
    assert response.status_code == 200
    out = response.json()
    assert out["displayname"] == "Adam"

    # Write a transaction via the post /wallet/transactions
    response = client.get("/wallet/transactions?sort=recent&limit=100")
    post_body = {
        "summary": {"value": 5321, "currency": "usd", "kind": "donation"},
        "details": [
            {
                "recipient": "org.flathub.Flathub",
                "amount": 5321,
                "currency": "usd",
                "kind": "donation",
            }
        ],
    }
    response = client.post(
        "/wallet/transactions", json=post_body, cookies=response.cookies
    )
    assert response.status_code == 200
    out = response.json()
    assert out["status"] == "ok"
    txn_id = out["id"]

    # View the newly created transaction
    response = client.get(f"/wallet/transactions/{txn_id}")
    out = response.json()
    assert response.status_code == 200
    assert out["summary"]["value"] == 5321
    assert out["details"][0]["recipient"] == "org.flathub.Flathub"
