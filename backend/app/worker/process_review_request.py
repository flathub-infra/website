import itertools
import json
from datetime import UTC, datetime

import dramatiq
import requests
import sentry_sdk

from .. import config, models, summary, utils
from ..db import get_json_key
from ..emails import EmailCategory
from ..types import ModerationRequestType
from .core import WorkerDB
from .emails import send_email_new


@dramatiq.actor
def process_review_request(build_id: int, job_id: int):
    try:
        flat_manager_token = utils.create_flat_manager_token(
            "process_review_request",
            ["build"],
            repos=["stable", "beta", "test"],
        )
        build_extended_url = (
            f"{config.settings.flat_manager_api}/api/v1/build/{build_id}/extended"
        )
        build_extended_headers = {
            "Authorization": f"{flat_manager_token}",
            "Content-Type": "application/json",
        }
        response = requests.get(build_extended_url, headers=build_extended_headers)
        response.raise_for_status()

        build_extended = response.json()
        build_metadata = build_extended.get("build")

        build_target_repo = build_metadata.get("repo")
        if build_target_repo in ("beta", "test"):
            return

        build_log_url = build_metadata.get("build_log_url")
        build_ref_arches = set()
        build_refs = build_extended.get("build_refs")
        build_ref_arches = {
            build_ref.get("ref_name").split("/")[2]
            for build_ref in build_refs
            if len(build_ref.get("ref_name").split("/")) == 4
        }

        new_requests: list[models.ModerationRequest] = []

        try:
            build_ref_arch = build_ref_arches.pop()
            build_appstream = utils.appstream2dict(
                f"https://hub.flathub.org/build-repo/{build_id}/appstream/{build_ref_arch}/appstream.xml.gz"
            )
        except KeyError:
            # if build_ref_arches has no elements, something went terribly wrong with the build in general
            return

        r = requests.get(f"https://dl.flathub.org/build-repo/{build_id}/summary")
        r.raise_for_status()
        if not isinstance(r.content, bytes):
            # If the summary file is not a binary file, something also went wrong
            return

        with WorkerDB() as db:
            build_summary, _, _ = summary.parse_summary(r.content, db)

        sentry_context = {"build_summary": build_summary}

        for app_id, app_data in build_appstream.items():
            is_new_submission = True

            keys = {
                "name": app_data.get("name"),
                "summary": app_data.get("summary"),
                "developer_name": app_data.get("developer_name"),
                "project_license": app_data.get("project_license"),
            }
            current_values = {}

            # Check if the app data matches the current appstream
            if app := get_json_key(f"apps:{app_id}"):
                is_new_submission = False

                current_values["name"] = app.get("name")
                current_values["summary"] = app.get("summary")
                current_values["developer_name"] = app.get("developer_name")
                current_values["project_license"] = app.get("project_license")

                for key, value in current_values.items():
                    if value == keys[key]:
                        keys.pop(key, None)

            # Don't consider the first "official" buildbot build as a new submission
            # as it has been already reviewed manually on GitHub
            if is_new_submission and build_metadata.get("token_name") in (
                "default",
                "flathub-ci",
                "buildbot",
            ):
                continue

            if app_id in (
                "org.freedesktop.Platform",
                "org.freedesktop.Sdk",
                "org.gnome.Platform",
                "org.gnome.Sdk",
                "org.kde.Platform",
                "org.kde.Sdk",
                "org.flatpak.Builder",
            ):
                continue

            if "keys" not in locals():
                keys = {}
            if "current_values" not in locals():
                current_values = {}

            with WorkerDB() as db:
                if direct_upload_app := models.DirectUploadApp.by_app_id(db, app_id):
                    if not direct_upload_app.first_seen_at:
                        direct_upload_app.first_seen_at = datetime.now(UTC)
                        db.session.commit()
                        is_new_submission = True
                        current_values = {"direct upload": False}
                        keys = {"direct upload": True}

            with WorkerDB() as db:
                current_summary = None
                current_permissions = None
                current_extradata = False

                app = models.App.by_appid(db, app_id)
                if app and app.summary:
                    current_summary = app.summary
                    sentry_context[f"summary:{app_id}:stable"] = current_summary

                    if current_metadata := current_summary.get("metadata", {}):
                        current_permissions = current_metadata.get("permissions")
                        current_extradata = bool(current_metadata.get("extra-data"))
                elif current_summary := get_json_key(f"summary:{app_id}:stable"):
                    sentry_context[f"summary:{app_id}:stable"] = current_summary

                    if current_metadata := current_summary.get("metadata", {}):
                        current_permissions = current_metadata.get("permissions")
                        current_extradata = bool(current_metadata.get("extra-data"))

                if current_summary:
                    build_summary_app = build_summary.get(app_id) or {}
                    build_summary_metadata = build_summary_app.get("metadata") or {}
                    build_permissions = build_summary_metadata.get("permissions") or {}
                    build_extradata = bool(
                        build_summary_metadata.get("extra-data", False)
                    )

                    if current_extradata != build_extradata:
                        current_values["extra-data"] = current_extradata
                        keys["extra-data"] = build_extradata

                    if current_permissions and build_permissions:
                        if current_permissions != build_permissions:
                            for perm in current_permissions:
                                current_perm = current_permissions[perm]
                                build_perm = build_permissions.get(perm)

                                if isinstance(current_perm, list):
                                    if current_perm != build_perm:
                                        current_values[perm] = current_perm
                                        keys[perm] = build_perm

                                if isinstance(current_perm, dict):
                                    if build_perm is None:
                                        build_perm = {}

                                    dict_keys = current_perm.keys() | build_perm.keys()
                                    for key in dict_keys:
                                        if current_perm.get(key) != build_perm.get(key):
                                            current_values[f"{key}-{perm}"] = (
                                                current_perm.get(key)
                                            )
                                            keys[f"{key}-{perm}"] = build_perm.get(key)

            if len(keys) > 0:
                keys = sort_lists_in_dict(keys)
                current_values = sort_lists_in_dict(current_values)

                request = models.ModerationRequest(
                    appid=app_id,
                    request_type=ModerationRequestType.APPDATA,
                    request_data=json.dumps(
                        {"keys": keys, "current_values": current_values}
                    ),
                    is_new_submission=is_new_submission,
                    is_outdated=False,
                    build_id=build_id,
                    job_id=job_id,
                    build_log_url=build_log_url,
                )
                new_requests.append(request)

        # Mark previous requests as outdated, to avoid flooding the moderation queue with requests that probably aren't
        # relevant anymore. Outdated requests can still be viewed and approved, but they're hidden by default.
        with WorkerDB() as db:
            app_ids = set(request.appid for request in new_requests)
            for app_id in app_ids:
                db.session.query(models.ModerationRequest).filter_by(
                    appid=app_id, is_outdated=False
                ).update({"is_outdated": True})

            if len(new_requests) == 0:
                return

            for request in new_requests:
                db.session.add(request)
            db.session.commit()

            if config.settings.moderation_observe_only:
                return

            apps = itertools.groupby(new_requests, lambda r: r.appid)
            for app_id, request_list in apps:
                request_list = list(request_list)

                if app_metadata := get_json_key(f"apps:{app_id}"):
                    app_name = app_metadata["name"]
                else:
                    app_name = None

                payload = {
                    "messageId": f"{app_id}/{build_id}/held",
                    "creation_timestamp": datetime.now(UTC).timestamp(),
                    "subject": f"Build #{build_id} held for review",
                    "previewText": f"Build #{build_id} held for review",
                    "inform_moderators": True,
                    "messageInfo": {
                        "category": EmailCategory.MODERATION_HELD,
                        "appId": request.appid,
                        "appName": app_name,
                        "buildId": build_id,
                        "buildLogUrl": request.build_log_url,
                        "requests": [
                            {
                                "requestType": request.request_type,
                                "requestData": json.loads(request.request_data),
                                "isNewSubmission": request.is_new_submission,
                            }
                            for request in request_list
                        ],
                    },
                }

                send_email_new.send(payload)

    except Exception as e:
        sentry_sdk.capture_exception(e)
        raise


def sort_lists_in_dict(data: dict) -> dict:
    """Sort any lists found in the dictionary recursively."""
    if isinstance(data, dict):
        for key, value in data.items():
            data[key] = sort_lists_in_dict(value)
    elif isinstance(data, list):
        data.sort()
    return data
