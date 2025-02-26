import json

import httpx

from . import db
from .database import get_db
from .models import Exceptions
from sqlalchemy import delete


def update():
    r = httpx.get(
        "https://raw.githubusercontent.com/barthalion/flatpak-builder-lint/HEAD/flatpak_builder_lint/staticfiles/exceptions.json"
    )

    if r.status_code == 200:
        exceptions = r.json()
        all_exceptions_json = r.text
        
        with get_db("writer") as db_session:
            existing_exceptions = Exceptions.get_all_exceptions(db_session)
            existing_app_ids = set(existing_exceptions.keys())
            new_app_ids = set(exceptions.keys())
            
            app_ids_to_delete = existing_app_ids - new_app_ids
            if app_ids_to_delete:
                db_session.execute(
                    delete(Exceptions).where(Exceptions.app_id.in_(app_ids_to_delete))
                )
            
            for app_id, exception_data in exceptions.items():
                Exceptions.set_exception(db_session, app_id, exception_data)
            
            if app_ids_to_delete:
                redis_keys_to_delete = [f"exc:{app_id}" for app_id in app_ids_to_delete]
                if redis_keys_to_delete:
                    db.redis_conn.delete(*redis_keys_to_delete)
