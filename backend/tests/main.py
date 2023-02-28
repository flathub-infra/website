import datetime
import glob
import json
import os
import shutil
import sys
import tempfile
import time

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


vcr = vcr.VCR(
    cassette_library_dir="tests/cassettes", ignore_hosts=["localhost", "testserver"]
)


class Override:
    def __init__(self, dependency, replacement) -> None:
        from app import main

        self._dependency = dependency
        if dependency in main.app.dependency_overrides:
            self._original = main.app.dependency_overrides[dependency]
        else:
            self._original = None
        main.app.dependency_overrides[dependency] = replacement

    def __enter__(self):
        pass

    def __exit__(self, *args):
        from app import main

        if self._original is None:
            del main.app.dependency_overrides[self._dependency]
        else:
            main.app.dependency_overrides[self._dependency] = self._replacement


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


@pytest.fixture
def client():
    from app import main

    with TestClient(main.app) as client_:
        yield client_


def test_update(client):
    update = client.post("/update")
    assert update.status_code == 200
    time.sleep(3)

    update_stats = client.post("/update/stats")
    assert update_stats.status_code == 200


def test_apps_by_category(client):
    response = client.get("/category/Game")
    assert response.status_code == 200
    assert response.json() == _get_expected_json_result("test_apps_by_category")


def test_apps_by_category_paginated(client):
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
    response = client.get("/compat/picks/apps")
    assert response.status_code == 200


def test_picked_games(client):
    response = client.get("/compat/picks/games")
    assert response.status_code == 200


def test_picked_non_existent(client):
    response = client.get("/compat/picks/NonExistent")
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
    time.sleep(3)
    response = client.get("/stats")
    today = datetime.date.today()
    yesterday = today - datetime.timedelta(days=1)
    day_before_yesterday = today - datetime.timedelta(days=2)
    three_days_ago = today - datetime.timedelta(days=3)
    expected = {
        "category_totals": {
            "AudioVideo": 0,
            "Development": 0,
            "Education": 0,
            "Game": 1,
            "Graphics": 0,
            "Network": 1,
            "Office": 1,
            "Science": 0,
            "System": 0,
            "Utility": 0,
        },
        "countries": {"AD": 45, "BR": 67},
        "downloads_per_day": {},
        "delta_downloads_per_day": {},
        "updates_per_day": {},
        "downloads": 3685,
        "number_of_apps": 3,
    }
    expected["delta_downloads_per_day"][three_days_ago.isoformat()] = 51
    expected["delta_downloads_per_day"][day_before_yesterday.isoformat()] = 15
    expected["delta_downloads_per_day"][yesterday.isoformat()] = 15
    expected["delta_downloads_per_day"][today.isoformat()] = 15
    expected["downloads_per_day"][three_days_ago.isoformat()] = 199
    expected["downloads_per_day"][day_before_yesterday.isoformat()] = 703
    expected["downloads_per_day"][yesterday.isoformat()] = 1964
    expected["downloads_per_day"][today.isoformat()] = 819
    expected["updates_per_day"][three_days_ago.isoformat()] = 56
    expected["updates_per_day"][day_before_yesterday.isoformat()] = 5
    expected["updates_per_day"][yesterday.isoformat()] = 5
    expected["updates_per_day"][today.isoformat()] = 5

    assert response.status_code == 200
    assert response.json() == expected


def test_app_stats_by_id(client):
    response = client.get("/stats/org.sugarlabs.Maze")

    today = datetime.date.today()
    day_before_yesterday = today - datetime.timedelta(days=2)
    three_days_ago = today - datetime.timedelta(days=3)
    expected = {
        "installs_total": 467,
        "installs_per_day": {
            three_days_ago.isoformat(): 460,
            day_before_yesterday.isoformat(): 6,
        },
        "installs_last_month": 467,
        "installs_last_7_days": 467,
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


def test_valid_app_ids():
    from app.utils import is_valid_app_id

    assert is_valid_app_id("org.gnome.Maps")
    assert is_valid_app_id("a.b.c.d.e")
    assert is_valid_app_id("a.b-c.d")

    assert not is_valid_app_id("com.example")
    assert not is_valid_app_id("..")
    assert not is_valid_app_id("a..c")
    assert not is_valid_app_id("com.7zip.7zip")
    assert not is_valid_app_id("com.example." + ("A" * 255))


def test_verification_domain_names():
    from app.verification import _get_domain_name

    assert _get_domain_name("com.github.Example") is None
    assert _get_domain_name("com.gitlab.Example") is None

    assert _get_domain_name("io.github.example.App") == "example.github.io"
    assert _get_domain_name("io.gitlab.example.App") == "example.gitlab.io"

    assert _get_domain_name("org.flathub.TestApp") == "flathub.org"
    assert _get_domain_name("org._0example.TestApp") == "0example.org"
    assert _get_domain_name("org.example_website.TestApp") == "example-website.org"
    assert _get_domain_name("org._0_example.TestApp") == "0-example.org"


@vcr.use_cassette("login_cassette")
def _login(client):
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


def test_verification_status(client):
    response = client.get("/verification/com.github.flathub.NotVerified/status")
    expected = {
        "verified": False,
    }
    assert response.status_code == 200
    assert response.json() == expected


def test_verification_available_method_website(client):
    _login(client)

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


@vcr.use_cassette("github_user_cassette")
def test_verification_available_method_multiple(client):
    _login(client)

    response = client.get(
        "/verification/io.github.ajr0d.FlathubTestApp/available-methods"
    )
    expected = {
        "methods": [
            {
                "method": "website",
                "website": "ajr0d.github.io",
            },
            {
                "method": "login_provider",
                "login_provider": "github",
                "login_name": "ajr0d",
                "login_is_organization": False,
                "login_status": "ready",
            },
        ]
    }
    assert response.status_code == 200
    assert response.json() == expected


def test_verification_status_invalid(client):
    response = client.get("/verification/com.github/status")
    expected = {
        "verified": False,
    }
    assert response.status_code == 200
    assert response.json() == expected


def test_verification_requires_login(client):
    response = client.post("/verification/org.gnome.Maps/setup-website-verification")
    assert response.status_code == 403
    assert response.json()["detail"] == "not_logged_in"

    response = client.post("/verification/org.gnome.Maps/verify-by-login-provider")
    assert response.status_code == 403
    assert response.json()["detail"] == "not_logged_in"


def test_verification_app_id_errors(client):
    _login(client)

    # Test when the app ID is not valid
    response = client.post("/verification/org.gnome/setup-website-verification")
    assert response.status_code == 400
    assert response.json()["detail"] == "malformed_app_id"

    response = client.post("/verification/org.gnome/verify-by-login-provider")
    assert response.status_code == 400
    assert response.json()["detail"] == "malformed_app_id"

    # Test when the app is not in the user's developer flatpaks
    response = client.post(
        "/verification/org.gnome.Calendar/setup-website-verification"
    )
    assert response.status_code == 401
    assert response.json()["detail"] == "not_app_developer"

    response = client.post("/verification/org.gnome.Calendar/verify-by-login-provider")
    assert response.status_code == 401
    assert response.json()["detail"] == "not_app_developer"


@vcr.use_cassette()
def test_verification_website_check():
    from app.verification import CheckWebsiteVerification

    # Make sure verification works
    response = CheckWebsiteVerification()(
        "org.gnome.Maps", "c741630f-1756-44cb-a1f9-3641fb231cad"
    )
    assert response.verified

    # Make sure verification fails if the token isn't present
    response = CheckWebsiteVerification()("org.gnome.Maps", "not-the-correct-token")
    assert not response.verified
    assert response.detail == "app_not_listed"

    # Make sure the status code is reported if there is an error
    response = CheckWebsiteVerification()("org.gnome.Maps", "404")
    assert not response.verified
    assert response.detail == "server_returned_error"
    assert response.status_code == 404


def test_verification_website(client):
    from app.verification import CheckWebsiteVerification, WebsiteVerificationResult

    _login(client)

    # Begin the verification process
    response = client.post("/verification/org.gnome.Maps/setup-website-verification")
    assert response.status_code == 200

    # Setting it up again should return the same token, not a new one
    second_response = client.post(
        "/verification/org.gnome.Maps/setup-website-verification"
    )
    assert second_response.status_code == 200
    assert second_response.json() == response.json()

    # Override the actual check so we don't have to mess with cassettes
    class CheckWebsiteVerificationOverride:
        def __call__(self, _appid: str, _token: str):
            return WebsiteVerificationResult(verified=True)

    with Override(CheckWebsiteVerification, CheckWebsiteVerificationOverride):
        # Confirm verification
        response = client.post(
            "/verification/org.gnome.Maps/confirm-website-verification"
        )
        assert response.status_code == 200
        assert response.json() == {
            "verified": True,
        }

    # Make sure the verification worked
    response = client.get("/verification/org.gnome.Maps/status")
    assert response.status_code == 200
    json = response.json()
    assert json["verified"] == True
    assert json["method"] == "website"
    assert json["website"] == "gnome.org"

    # Unverify the app
    response = client.post("/verification/org.gnome.Maps/unverify")
    assert response.status_code == 204

    # Make sure unverification worked
    response = client.get("/verification/org.gnome.Maps/status")
    assert response.status_code == 200
    assert response.json() == {
        "verified": False,
    }


@vcr.use_cassette("github_user_cassette")
def test_verification_github(client):
    _login(client)

    response = client.post(
        "/verification/io.github.ajr0d.FlathubTestApp/verify-by-login-provider"
    )
    assert response.status_code == 200

    response = client.get("/verification/io.github.ajr0d.FlathubTestApp/status")
    assert response.status_code == 200
    json = response.json()
    assert json["verified"] == True
    assert json["method"] == "login_provider"
    assert json["login_provider"] == "github"
    assert json["login_name"] == "ajr0d"
    assert json["login_is_organization"] == False

    # Unverify the app
    response = client.post("/verification/io.github.ajr0d.FlathubTestApp/unverify")
    assert response.status_code == 204

    # Make sure unverification worked
    response = client.get("/verification/io.github.ajr0d.FlathubTestApp/status")
    assert response.status_code == 200
    assert response.json() == {
        "verified": False,
    }


@vcr.use_cassette("github_user_cassette")
def test_double_verification_forbidden(client):
    _login(client)

    # Verify an app by login provider
    response = client.post(
        "/verification/io.github.ajr0d.FlathubTestApp/verify-by-login-provider"
    )
    assert response.status_code == 200

    # The app shouldn't be verifiable via website
    response = client.post(
        "/verification/io.github.ajr0d.FlathubTestApp/setup-website-verification"
    )
    assert response.status_code == 403
    assert response.json()["detail"] == "app_already_verified"

    # Unverify the app to reset the database
    response = client.post("/verification/io.github.ajr0d.FlathubTestApp/unverify")
    assert response.status_code == 204


def test_verification_status_not_verified(client):
    response = client.get("/verification/org.gnome.Calendar/status")
    expected = {
        "verified": False,
    }
    assert response.status_code == 200
    assert response.json() == expected


# @vcr.use_cassette(record_mode="once")
# def test_auth_login_github(client):
#     response = client.get("/auth/login/github")
#     assert response.status_code == 200
#     out = response.json()
#     assert out["state"] == "ok"
#     state = dict(parse.parse_qsl(parse.urlparse(out["redirect"]).query))["state"]
#     print(state)
#     post_body = {"code": "d57f9d32d58f76dfcce7", "state": state}
#     response = client.post(
#         "/auth/login/github", json=post_body, cookies=response.cookies
#     )
#     assert response.status_code == 200


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


# @vcr.use_cassette(record_mode="once")
# def test_auth_login_google(client):
#     response = client.get("/auth/login/google")
#     assert response.status_code == 200
#     out = response.json()
#     assert out["state"] == "ok"
#     state = dict(parse.parse_qsl(parse.urlparse(out["redirect"]).query))["state"]
#     print(state)
#     encodedStr = (
#         "4%2F0AX4XfWh9fGMl1g5n_RisJiN5qV2tVUnC6d3lDoWJn-1kyQ5f2FsGkyy_cFnsQFmOU2jllg"
#     )
#     code = parse.unquote(encodedStr)
#     post_body = {
#         "code": code,
#         "state": state,
#     }
#     response = client.post(
#         "/auth/login/google", json=post_body, cookies=response.cookies
#     )
#     assert response.status_code == 200


def test_fakewallet(client):
    from app import config

    if config.settings.stripe_public_key:
        pytest.skip("Stripe is configured")

    _login(client)

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
