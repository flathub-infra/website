#!/bin/bash
alembic upgrade heads
granian --interface asgi app.main:app --host 0.0.0.0 --port 8000 \
  --no-http1-keep-alive \
  --workers-lifetime 3600 \
  --respawn-failed-workers \
  --workers-kill-timeout 30 \
  --access-log $@
