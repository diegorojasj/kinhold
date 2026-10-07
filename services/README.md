# Kinhold services

Five Django + Django Ninja services (async views, served by uvicorn) behind one API gateway. Devices work offline and sync with them; changes reach the other members' phones live.

```
 phone / browser ── /api/<service>/… ──▶ api-gateway (Caddy, containers/gateway/Caddyfile)
                                           │ forward_auth → household-service /auth/verify
                                           │   (device token + membership of the household in the path)
                                           ▼
   household-service   households, members, activity, devices, invites, SSE stream (/events)
   shopping-service    items, catalog
   chores-service      chores, events (done / skipped)
   money-service       expenses, settlements
   bills-service       bills, payments
          │                                   │
     Postgres (one schema per service)    Valkey pub/sub "household H: service X is at cursor N"
```

| Folder | What |
|---|---|
| `common/` | Shared by every service: settings, gateway auth, the `{code, message, details}` error format, Valkey events and the **sync engine** (`common/sync/`) |
| `<name>-service/config/` | Django settings (schema name), urls, asgi |
| `<name>-service/src/models/` | Django models (`SyncedModel` subclasses) |
| `<name>-service/src/schemas/` | Pydantic record schemas: validation, camelCase on the wire |
| `<name>-service/src/synced.py` | The service's collections and their permission rules |
| `<name>-service/src/controllers/` | Ninja API |
| `household-service/src/services/` | Devices, invites, households (identity lives here) |

## How sync works

1. **Offline first.** The app writes to its own copy of the data and queues an *op* per change: "set these fields of record R at time T". Ids are made on the device (D-08).
2. **Push** `POST /api/<service>/households/<id>/sync` with a batch of ops. For every field, the server keeps the value with the newest timestamp (last-write-wins per field, D-09), so retrying an op or receiving ops out of order is harmless. Each op is validated as a whole record after the merge (e.g. splits add up to the total, the RRULE parses). A rejected op comes back with the server's version, and the device reverts to it.
3. **Seq.** Every accepted write takes the next value of the service's `sync_seq`. Writes to one household are serialised with a Postgres advisory lock, so seq order is commit order.
4. **Pull** `GET …/sync?since=<cursor>` returns everything newer than the device's cursor, deletions included (tombstones), in one snapshot. `reset: true` means the device's cursor is ahead of the server (database restored), so it starts again from 0.
5. **Live.** After a write, the service publishes `{householdId, service, cursor}` on Valkey. household-service relays it to every device of that household over SSE (`GET /api/household/events`), and the device pulls. If Valkey is down, writes still work and devices fall back to polling every 30 s.

**Identity.** `POST /api/household/devices` gives an install a token, with no account needed. A device creates households (`POST /api/household/households`) or joins one with a single-use, 7-day invite code (`GET /invites/<code>`, then `POST /invites/<code>/accept`), either as someone already in the household or as a new member. Removing a member cuts off their devices; undoing the removal restores them.

**Gateway.** Services trust the `X-Kinhold-*` identity headers only together with `X-Kinhold-Gateway: $GATEWAY_SECRET`, which only the gateway adds. The gateway strips any such headers a client sends.

## Run

```bash
cp .env.example .env              # once, then change the secrets
podman-compose --profile DEV up --build      # or docker compose; PROD profile for nginx + static build
```

The gateway listens on `:8000`. Each service has `/api/<service>/health` and `/api/<service>/docs` (OpenAPI).

## Develop and test

```bash
cd services
python -m venv .venv && .venv/bin/pip install -r requirements.dev
podman-compose up -d database valkey         # Postgres on localhost:54322 (see .env.example)

cd shopping-service
../.venv/bin/pytest                          # tests run against the real Postgres (+ Valkey for the SSE test)
../.venv/bin/python manage.py makemigrations shopping
../.venv/bin/ruff check .. && ../.venv/bin/ruff format ..
```

The shared engine is tested through shopping-service (`tests/test_sync.py`); each service tests its own rules.

## Add a synced collection

1. Model: subclass `common.sync.SyncedModel` in `src/models/` and give every field a default.
2. Schema: subclass `common.sync.RecordSchema` in `src/schemas/`, with field names matching the model.
3. Register `Collection("name", Model, Schema, authorize=...)` in `src/synced.py`, then run `makemigrations <service>`.
4. Frontend: `arrayCollection(store, '<service>', 'name', (s) => s.list)` in the store.
