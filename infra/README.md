# infra/

Future home of the local and deployment environment — `docker-compose.yml` (Postgres + PostGIS, Redis, MinIO, backend, ai-service), nginx configs, and deployment settings.

> Created in **Phase 1 · P1-T5**; production Dockerfiles and CD configs in **Phase 16**.

## Local stack

**Phase 1 · P1-T5 — local development only.** Production Dockerfiles and CD configs arrive in Phase 16 (P16-T2).

### Prerequisites

- Docker Desktop with Compose v2 (always use `docker compose`, never `docker-compose`).
- Node/Python are not needed on the host — application source is bind-mounted from the repo and runs in containers.

### Setup

1. Copy the example env file (PowerShell):

   ```powershell
   copy infra\.env.example infra\.env
   ```

2. Replace every `change-me-*` / `change_me_*` placeholder in `infra\.env` with real local values. `infra\.env` is git-ignored; never commit it.

### Start

From `infra/`:

```powershell
docker compose up --build
```

Run detached with `docker compose up --build -d`. First start pulls images and builds the dev images once.

### Stop

```powershell
docker compose down
```

Removes containers; **named volumes (Postgres data, Redis persistence, MinIO storage) are kept**.

### Wipe volumes

```powershell
docker compose down -v
```

> ⚠️ **Warning:** `-v` deletes all named volumes — every database row, Redis key, and object in MinIO's local bucket is gone for good. There is no undo for local dev data.

### Services, URLs & ports

All published ports bind to `127.0.0.1` only (not exposed to the network).

| Service | Image (pinned) | Host URL / port | Notes |
|---|---|---|---|
| backend | built from `backend/Dockerfile.dev` (`node:24.22.1-bookworm-slim`) | `http://127.0.0.1:3000/health` | `BACKEND_PORT`; NestJS hot reload via bind mount |
| ai-service | built from `ai-service/Dockerfile.dev` (`python:3.12.15-slim-bookworm`) | `http://127.0.0.1:8000/health` | `AI_SERVICE_PORT`; uvicorn `--reload` via bind mount |
| postgres | `postgis/postgis:17-3.5` | `127.0.0.1:5432` | user/db/password from `infra\.env` |
| redis | `redis:8.2.10` | `127.0.0.1:6379` | password required (auth from `infra\.env`) |
| minio API | `bitnamilegacy/minio:2025.7.23-debian-12-r5` | `http://127.0.0.1:9000` | S3-compatible API |
| minio console | same image | `http://127.0.0.1:9001` | web console |
| minio-init | `bitnamilegacy/minio-client:2025.7.21-debian-12-r3` | — (one-shot, exits) | creates the PRIVATE bucket |

**MinIO console login:** open `http://127.0.0.1:9001` and use `MINIO_ROOT_USER` / `MINIO_ROOT_PASSWORD` from `infra\.env`. The `MINIO_BUCKET` created by `minio-init` is private (no anonymous access).

> **Note on the MinIO image:** the official `minio/minio` image was removed from Docker Hub and `quay.io/minio/minio` is no longer anonymously pullable (both verified 2026-10-24), so the stack uses Bitnami's last community build from the frozen `bitnamilegacy` namespace. Fine for local dev; production (P16-T2) should revisit this.

### Windows troubleshooting

- **"Docker Desktop is not running" / "error during connect"** — start Docker Desktop and wait until the whale icon shows "running", then `docker compose up --build` again.
- **Port already in use (`bind: address already in use` / `port is already allocated`)** — stop the local process occupying 3000, 8000, 5432, 6379, 9000 or 9001, or change `BACKEND_PORT` / `AI_SERVICE_PORT` in `infra\.env`.
- **File watching / hot reload not reacting** — Docker bind mounts on Windows do not always propagate file events to containers. The compose file already enables polling (`CHOKIDAR_USEPOLLING=true` on the backend, `WATCHFILES_FORCE_POLLING=true` on the ai-service). If edits still don't arrive, check the file was actually saved and restart `docker compose up --build`.
- **Line endings (`\r` errors / CRLF scripts)** — the repo ships a `.gitattributes`; if a script inside a container fails on `\r`, run `git config core.autocrlf input` and `git add --renormalize .`.
- **Compose fails with "required variable X is missing"** — `infra\.env` is missing or incomplete; re-create it from `infra\.env.example` (see Setup). Validate with `docker compose config`.
