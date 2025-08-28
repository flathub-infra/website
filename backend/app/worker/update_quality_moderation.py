import dramatiq

from .. import apps, models
from ..database import get_db, get_json_key


@dramatiq.actor
def update_quality_moderation():
    with get_db("writer") as db:
        appids = apps.get_appids(include_eol=True)

        if not appids:
            return

        appids_for_frontend = [
            app_id for app_id in appids if app_id and get_json_key(f"apps:{app_id}")
        ]

        if not appids_for_frontend:
            return

        for app_id in appids_for_frontend:
            if value := get_json_key(f"apps:{app_id}"):
                # Check app name length
                models.QualityModeration.upsert(
                    db,
                    app_id,
                    "app-name-not-too-long",
                    "name" in value and len(value["name"]) <= 20,
                    None,
                )

                # Check app summary length
                models.QualityModeration.upsert(
                    db,
                    app_id,
                    "app-summary-not-too-long",
                    "summary" in value and len(value["summary"]) <= 35,
                    None,
                )

                models.QualityModeration.upsert(
                    db,
                    app_id,
                    "screenshots-at-least-one-screenshot",
                    "screenshots" in value and len(value["screenshots"]) >= 1,
                    None,
                )

                models.QualityModeration.upsert(
                    db,
                    app_id,
                    "branding-has-primary-brand-colors",
                    "branding" in value
                    and (
                        (
                            any(
                                branding
                                for branding in value["branding"]
                                if "type" in branding
                                and "scheme_preference" in branding
                                and "value" in branding
                                and branding["type"] == "primary"
                                and branding["scheme_preference"] == "light"
                            )
                            and any(
                                branding
                                for branding in value["branding"]
                                if "type" in branding
                                and "scheme_preference" in branding
                                and "value" in branding
                                and branding["type"] == "primary"
                                and branding["scheme_preference"] == "dark"
                            )
                        )
                        or (
                            any(
                                branding
                                for branding in value["branding"]
                                if "type" in branding
                                and "scheme_preference" in branding
                                and "value" in branding
                                and branding["type"] == "primary"
                                and (
                                    branding["scheme_preference"] == "light"
                                    or branding["scheme_preference"] == "dark"
                                )
                            )
                            and any(
                                branding
                                for branding in value["branding"]
                                if "type" in branding
                                and "scheme_preference" not in branding
                                and "value" in branding
                                and branding["type"] == "primary"
                            )
                        )
                        or any(
                            branding
                            for branding in value["branding"]
                            if "type" in branding
                            and "value" in branding
                            and branding["type"] == "primary"
                        )
                    ),
                    None,
                )
                if summary_dict := get_json_key(f"summary:{app_id}:stable"):
                    runtime_is_not_eol = True
                    if (
                        "metadata" in summary_dict
                        and summary_dict["metadata"]
                        and "runtime" in summary_dict["metadata"]
                        and summary_dict["metadata"]["runtime"]
                    ):
                        runtime_parts = summary_dict["metadata"]["runtime"].split("/")
                        if len(runtime_parts) >= 2:
                            runtime_appid = runtime_parts[0]
                            runtime_branch = (
                                runtime_parts[2] if len(runtime_parts) > 2 else "stable"
                            )
                            runtime_is_eol = models.App.get_eol_data(
                                db, runtime_appid, runtime_branch
                            )
                            runtime_is_not_eol = not runtime_is_eol

                    models.QualityModeration.upsert(
                        db,
                        app_id,
                        "general-runtime-not-eol",
                        runtime_is_not_eol,
                        None,
                    )
