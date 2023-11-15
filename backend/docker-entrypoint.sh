#!/bin/bash
alembic upgrade head
uvicorn app.main:router --host 0.0.0.0 --port 8000 $@
