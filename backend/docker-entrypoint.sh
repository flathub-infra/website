#!/bin/bash
alembic upgrade heads
uvicorn app.main:router --host 0.0.0.0 --port 8000 --forwarded-allow-ips='*' $@
