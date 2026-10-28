#!/bin/bash
alembic upgrade heads
app=app.main:app
if [ -n "${MEMRAY_OUTPUT_DIR:-}" ]; then
  app=app.memory_profile:app
fi
granian --interface asgi "$app" --host 0.0.0.0 --port 8000 \
  --no-http1-keep-alive \
  --workers-lifetime 3600 \
  --respawn-failed-workers \
  --workers-kill-timeout 30 \
  --access-log $@
