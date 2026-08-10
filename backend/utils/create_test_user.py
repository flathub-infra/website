#!/usr/bin/env python3

# This script creates a local test user to log in to the backend and
# frontend locally. Run it as `uv run utils/create_test_user.py` from
# ./backend. Once the session cookie is printed
# go to http://localhost:3001/ frontend on Firefox > right click
# > inspect > storage > cookies > http://localhost:3001
# > Click the + Add item > Create a new cookie called 'session', put
# the previous session cokkie from the script as value and the Path
# should be '/'. Then refreshing the page will log-in to the frontend.

import json
import sys
from base64 import b64encode

import itsdangerous
import psycopg

SECRET_KEY = "change-me-for-production"
DB_DSN = "postgresql://postgres:postgres@localhost:5432/postgres"


def create_test_user(display_name: str) -> int:
    with psycopg.connect(DB_DSN) as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO flathubuser (display_name, default_account)
                VALUES (%s, 'github')
                RETURNING id
                """,
                (display_name,),
            )
            user_id = cur.fetchone()[0]
            # Frontend wants at least one connected account though we
            # won't use this anyways
            cur.execute(
                """
                INSERT INTO githubaccount ("user", github_userid, login, last_used)
                VALUES (%s, %s, %s, now())
                """,
                (user_id, 99999999 + user_id, f"localtest-{user_id}"),
            )
        conn.commit()
    return user_id


def sign_session_cookie(session_dict: dict) -> str:
    signer = itsdangerous.TimestampSigner(SECRET_KEY)
    data = b64encode(json.dumps(session_dict).encode("utf-8"))
    signed = signer.sign(data)
    return signed.decode("utf-8")


def main():
    display_name = sys.argv[1] if len(sys.argv) > 1 else "Local Test User"
    user_id = create_test_user(display_name)
    cookie_value = sign_session_cookie({"user-id": user_id})
    print(
        f"Created flathubuser id={user_id} display_name={display_name!r} Session cookie value: {cookie_value}"
    )


if __name__ == "__main__":
    main()
