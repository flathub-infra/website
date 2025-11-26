#!/usr/bin/env python3
"""Test script to verify cache key generation matches between Python and Lua"""

import hashlib
import json

def make_cache_key_python(func_name, kwargs):
    """Python version of cache key generation (matching backend/app/cache.py)"""
    key_data = {
        "func": func_name,
        "kwargs": kwargs,
    }
    key_hash = hashlib.md5(json.dumps(key_data, sort_keys=True).encode()).hexdigest()
    return f"cache:endpoint:{func_name}:{key_hash}"


def test_cache_keys():
    """Test cache key generation for all cached endpoints"""

    test_cases = [
        # EOL Endpoints
        ("get_eol_rebase", {}, "/api/v2/eol/rebase"),
        ("get_eol_message", {}, "/api/v2/eol/message"),
        ("get_eol_rebase_appid", {"app_id": "org.gnome.Glade", "branch": "stable"}, "/api/v2/eol/rebase/org.gnome.Glade"),
        ("get_eol_message_appid", {"app_id": "org.gnome.Glade", "branch": "stable"}, "/api/v2/eol/message/org.gnome.Glade"),
        ("get_eol_rebase_appid", {"app_id": "org.kde.Kate", "branch": "beta"}, "/api/v2/eol/rebase/org.kde.Kate?branch=beta"),

        # Appstream Endpoints
        ("list_appstream", {"filter": "apps", "sort": "alphabetical"}, "/api/v2/appstream"),
        ("list_appstream", {"filter": "runtime", "sort": "created-at"}, "/api/v2/appstream?filter=runtime&sort=created-at"),
        ("get_appstream", {"app_id": "org.gnome.Glade", "locale": "en"}, "/api/v2/appstream/org.gnome.Glade"),
        ("get_appstream", {"app_id": "org.kde.Kate", "locale": "fr"}, "/api/v2/appstream/org.kde.Kate?locale=fr"),

        # Summary Endpoints
        ("get_summary", {"app_id": "org.gnome.Glade", "branch": None}, "/api/v2/summary/org.gnome.Glade"),
        ("get_summary", {"app_id": "org.kde.Kate", "branch": "beta"}, "/api/v2/summary/org.kde.Kate?branch=beta"),

        # Verification Endpoints
        ("get_verification_status", {"app_id": "org.vinegarhq.Sober"}, "/api/v2/verification/org.vinegarhq.Sober/status"),
        ("get_verification_status", {"app_id": "org.gnome.Glade"}, "/api/v2/verification/org.gnome.Glade/status"),

        # is-fullscreen-app endpoint
        ("get_isFullscreenApp", {"app_id": "org.gnome.Glade"}, "/api/v2/is-fullscreen-app/org.gnome.Glade"),
        ("get_isFullscreenApp", {"app_id": "org.kde.Kate"}, "/api/v2/is-fullscreen-app/org.kde.Kate"),
        ("get_isFullscreenApp", {"app_id": "tv.kodi.Kodi"}, "/api/v2/is-fullscreen-app/tv.kodi.Kodi"),

        # addon endpoint
        ("get_addons", {"app_id": "org.gnome.Glade"}, "/api/v2/addon/org.gnome.Glade"),
        ("get_addons", {"app_id": "org.blender.Blender"}, "/api/v2/addon/org.blender.Blender"),

        # stats endpoint (no params)
        ("get_stats", {}, "/api/v2/stats"),

        # stats for specific app - test all query param combinations
        ("get_stats_for_app", {"app_id": "org.gnome.Glade", "all": False, "days": 180}, "/api/v2/stats/org.gnome.Glade"),
        ("get_stats_for_app", {"app_id": "org.gnome.Glade", "all": True, "days": 180}, "/api/v2/stats/org.gnome.Glade?all=true"),
        ("get_stats_for_app", {"app_id": "org.kde.Kate", "all": False, "days": 90}, "/api/v2/stats/org.kde.Kate?days=90"),
        ("get_stats_for_app", {"app_id": "org.kde.Kate", "all": True, "days": 365}, "/api/v2/stats/org.kde.Kate?all=true&days=365"),
        ("get_stats_for_app", {"app_id": "tv.kodi.Kodi", "all": False, "days": 30}, "/api/v2/stats/tv.kodi.Kodi?days=30"),

        # app-of-the-day endpoint
        ("get_app_of_the_day", {"date": "2021-01-01"}, "/api/v2/app-picks/app-of-the-day/2021-01-01"),
        ("get_app_of_the_day", {"date": "2023-10-21"}, "/api/v2/app-picks/app-of-the-day/2023-10-21"),
        ("get_app_of_the_day", {"date": "2025-11-26"}, "/api/v2/app-picks/app-of-the-day/2025-11-26"),

        # apps-of-the-week endpoint
        ("get_app_of_the_week", {"date": "2021-01-01"}, "/api/v2/app-picks/apps-of-the-week/2021-01-01"),
        ("get_app_of_the_week", {"date": "2023-10-21"}, "/api/v2/app-picks/apps-of-the-week/2023-10-21"),
        ("get_app_of_the_week", {"date": "2025-11-26"}, "/api/v2/app-picks/apps-of-the-week/2025-11-26"),
    ]

    print("Python Cache Key Generation Test")
    print("=" * 80)

    for func_name, kwargs, uri in test_cases:
        cache_key = make_cache_key_python(func_name, kwargs)
        print(f"\nURI: {uri}")
        print(f"Function: {func_name}")
        print(f"Kwargs: {kwargs}")
        print(f"Cache Key: {cache_key}")

        # Show the JSON that gets hashed
        key_data = {"func": func_name, "kwargs": kwargs}
        json_str = json.dumps(key_data, sort_keys=True)
        print(f"JSON (sorted): {json_str}")
        print(f"MD5 Hash: {hashlib.md5(json_str.encode()).hexdigest()}")

    print("\n" + "=" * 80)
    print("\nNOTE: To verify Lua implementation:")
    print("1. Deploy the nginx container with the Lua code")
    print("2. Check nginx logs for cache key generation")
    print("3. Compare with the cache keys shown above")
    print("\nOr test Lua code separately using openresty CLI")


if __name__ == "__main__":
    test_cache_keys()
