# ai-service/

Future home of the **FastAPI inference service** (Python) — `/v1/predict`, `/v1/quality`, image-quality gate, plus training scripts/notebooks and ONNX export.

> Scaffolded in **Phase 1 · P1-T3**; the real model, training pipeline, and quality gate land in **Phase 6**.

## Local development (Windows)

```bat
python -m venv .venv
.venv\Scripts\python -m pip install -r requirements-dev.txt
.venv\Scripts\python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

Checks: `.venv\Scripts\python -m ruff check .` · `.venv\Scripts\python -m black --check .` · `.venv\Scripts\python -m mypy .` · `.venv\Scripts\python -m pytest`
