#!/bin/bash

uvicorn app.main:app --host 0.0.0.0 &
python -m pytest -s tests/main.py