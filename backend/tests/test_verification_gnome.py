import xml.etree.ElementTree as ET

import httpx
import pytest
import sentry_sdk

from app import verification

MUSIC_DOAP_URL = (
    "https://gitlab.gnome.org/GNOME/gnome-music/-/raw/HEAD/gnome-music.doap"
)


def test_gnome_music_doap_url(monkeypatch):
    def fetch_doap(url, *, follow_redirects):
        assert url == MUSIC_DOAP_URL
        assert follow_redirects
        return httpx.Response(
            200,
            request=httpx.Request("GET", url),
            text="""
            <Project xmlns="http://usefulinc.com/ns/doap#"
                     xmlns:foaf="http://xmlns.com/foaf/0.1/"
                     xmlns:gnome="http://api.gnome.org/doap-extensions#">
              <maintainer><foaf:Person><gnome:userid>gnome-user</gnome:userid>
              </foaf:Person></maintainer>
            </Project>
        """,
        )

    monkeypatch.setattr(verification.http_client, "get", fetch_doap)
    assert verification._get_provider_username("org.gnome.Music") == (
        verification.LoginProvider.GNOME_GITLAB,
        "gnome-user",
    )


@pytest.fixture
def lookup_gnome_music(monkeypatch):
    reports = []
    monkeypatch.setattr(
        verification,
        "_capture_gnome_doap_failure",
        lambda *args: reports.append(args),
    )

    def lookup(fetch_doap):
        with httpx.Client(transport=httpx.MockTransport(fetch_doap)) as client:
            monkeypatch.setattr(verification.http_client, "get", client.get)
            maintainers = verification._get_gnome_doap_maintainers(
                "org.gnome.Music", "GNOME"
            )
        return maintainers, reports

    return lookup


@pytest.mark.parametrize(
    ("accounts", "user_id", "expected"),
    [
        pytest.param(
            ["https://github.com"],
            "gnome-user",
            ["gnome-user"],
            id="github-with-userid",
        ),
        pytest.param(["https://github.com"], None, [], id="github-only"),
        pytest.param([None], "gnome-user", ["gnome-user"], id="unlabeled-account"),
        pytest.param([], "gnome-user", ["gnome-user"], id="userid-only"),
        pytest.param(
            ["https://gitlab.gnome.org"], None, ["account-0"], id="gnome-account-only"
        ),
        pytest.param(
            ["https://gitlab.gnome.org"],
            "older-userid",
            ["account-0"],
            id="gnome-account-preferred-over-userid",
        ),
        pytest.param(
            ["https://github.com", "https://gitlab.gnome.org/"],
            None,
            ["account-1"],
            id="gnome-account-after-github",
        ),
        pytest.param(
            ["https://GITLAB.GNOME.ORG/"], None, ["account-0"], id="uppercase-host"
        ),
        pytest.param(
            ["http://gitlab.gnome.org"], "gnome-user", ["gnome-user"], id="http-service"
        ),
        pytest.param(
            [("https://gitlab.gnome.org", "  ")],
            "  gnome-user  ",
            ["gnome-user"],
            id="blank-account-with-userid",
        ),
        pytest.param([], "  ", [], id="blank-userid"),
        pytest.param(
            [("https://gitlab.gnome.org", "  gnome-user  ")],
            None,
            ["gnome-user"],
            id="padded-account-name",
        ),
    ],
)
def test_gnome_doap_maintainers(accounts, user_id, expected):
    account_entries = []
    for index, account in enumerate(accounts):
        service, username = (
            account if isinstance(account, tuple) else (account, f"account-{index}")
        )
        homepage = (
            f'<foaf:accountServiceHomepage rdf:resource="{service}"/>'
            if service is not None
            else ""
        )
        account_entries.append(f"""
          <foaf:account>
            <foaf:OnlineAccount>
              {homepage}
              <foaf:accountName>{username}</foaf:accountName>
            </foaf:OnlineAccount>
          </foaf:account>
        """)

    userid = f"<gnome:userid>{user_id}</gnome:userid>" if user_id is not None else ""
    doap = f"""
    <Project xmlns="http://usefulinc.com/ns/doap#"
             xmlns:foaf="http://xmlns.com/foaf/0.1/"
             xmlns:gnome="http://api.gnome.org/doap-extensions#"
             xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
      <maintainer>
        <foaf:Person>
          {userid}
          {"".join(account_entries)}
        </foaf:Person>
      </maintainer>
    </Project>
    """

    assert verification._parse_gnome_doap_maintainers(ET.fromstring(doap)) == expected


@pytest.mark.parametrize(
    ("response", "reason"),
    [
        (httpx.Response(404), "http_404"),
        (
            httpx.Response(403, headers={"Content-Type": "application/xhtml+xml"}),
            "http_403",
        ),
        (
            httpx.Response(200, headers={"Content-Type": "Text/HTML; charset=utf-8"}),
            "unexpected_html",
        ),
        (
            httpx.Response(200, headers={"Content-Type": "application/xhtml+xml"}),
            "unexpected_html",
        ),
        (httpx.Response(200, text="<!DOCTYPE html><html><form>"), "unexpected_html"),
        (
            httpx.Response(200, text="<!-- GitLab -->\n<!DOCTYPE html><html><form>"),
            "unexpected_html",
        ),
        (httpx.Response(200, text="<!DOCTYPE html><body/>"), "unexpected_html"),
        (
            httpx.Response(
                200,
                text='<?xml version="1.0"?><html xmlns="http://www.w3.org/1999/xhtml"/>',
            ),
            "unexpected_html",
        ),
        (httpx.Response(200, text="<Project>"), "invalid_xml"),
        (
            httpx.Response(
                200, text='<Project xmlns="http://usefulinc.com/ns/doap#"/>'
            ),
            "no_maintainers",
        ),
        (httpx.ConnectError("connection failed"), "request_failed"),
    ],
)
def test_gnome_doap_failure_reports_reason(lookup_gnome_music, response, reason):
    def fetch_doap(_request):
        if isinstance(response, httpx.HTTPError):
            raise response
        return response

    maintainers, reports = lookup_gnome_music(fetch_doap)
    assert maintainers == []
    assert reports == [("org.gnome.Music", MUSIC_DOAP_URL, reason)]


@pytest.mark.parametrize("sign_in_status", [200, 302, 403])
def test_gnome_doap_reports_sign_in_redirect(lookup_gnome_music, sign_in_status):
    def fetch_doap(request):
        if request.url.path.endswith(".doap"):
            return httpx.Response(302, headers={"Location": "/users/sign_in"})
        if request.url.path == "/users/sign_in" and sign_in_status == 302:
            return httpx.Response(302, headers={"Location": "/sso"})
        if request.url.path == "/sso":
            return httpx.Response(200, text="SSO login")
        return httpx.Response(sign_in_status, text="Sign in")

    maintainers, reports = lookup_gnome_music(fetch_doap)
    assert maintainers == []
    assert reports == [("org.gnome.Music", MUSIC_DOAP_URL, "unexpected_html")]


def test_gnome_doap_sentry_warning_includes_lookup_details(monkeypatch):
    events = []

    def collect_event(event, _hint):
        events.append(event)

    monkeypatch.setattr(verification, "_gnome_doap_warning_hour", -1)
    monkeypatch.setattr(verification, "_gnome_doap_warnings", set())
    with (
        sentry_sdk.Client(
            dsn="https://public@example.org/1",
            default_integrations=False,
            before_send=collect_event,
        ) as client,
        sentry_sdk.new_scope() as scope,
    ):
        scope.set_client(client)
        verification._capture_gnome_doap_failure(
            "org.gnome.Music", MUSIC_DOAP_URL, "http_404"
        )

    [event] = events
    assert event["level"] == "warning"
    assert event["tags"]["app_id"] == "org.gnome.Music"
    assert event["contexts"]["gnome_doap"] == {
        "url": MUSIC_DOAP_URL,
        "reason": "http_404",
    }


def test_gnome_doap_failure_deduplicates_and_caps_sentry_warnings(monkeypatch):
    capture = verification._capture_gnome_doap_failure
    events = []
    now = 3600
    monkeypatch.setattr(verification, "monotonic", lambda: now)
    monkeypatch.setattr(verification, "_gnome_doap_warning_hour", -1)
    monkeypatch.setattr(verification, "_gnome_doap_warnings", set())
    monkeypatch.setattr(verification, "_GNOME_DOAP_WARNING_LIMIT", 2)
    monkeypatch.setattr(
        verification.sentry_sdk,
        "capture_message",
        lambda message, *, level: events.append((message, level)),
    )
    capture("org.gnome.Music", MUSIC_DOAP_URL, "http_404")
    capture("org.gnome.Music", MUSIC_DOAP_URL, "http_404")
    assert events == [("GNOME DOAP lookup failed", "warning")]

    capture("org.gnome.Example", MUSIC_DOAP_URL, "invalid_xml")
    capture("org.gnome.Other", MUSIC_DOAP_URL, "unexpected_html")
    assert events == [("GNOME DOAP lookup failed", "warning")] * 2

    now += 3600
    capture("org.gnome.Music", MUSIC_DOAP_URL, "http_404")
    assert events == [("GNOME DOAP lookup failed", "warning")] * 3
