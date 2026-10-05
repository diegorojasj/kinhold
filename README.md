---
status: active
created: 2026-10-04
phase: planning
tags: [#casa, #planning, #django, #solidjs, #mongodb, #valkey]
---

# Casa — Planning phase

Planning for [[2026-10-04-casa-household-hub]]. Goal: finish this before writing feature code, so development (Oct 6–31) is just working through the backlog.

> [!info] Planning checklist
> - [ ] 1. Answer the open questions (bottom of this doc)
> - [ ] 2. Run the week-0 spikes and record the results
> - [ ] 3. Freeze MVP scope + data model
> - [ ] 4. Create repo skeleton + CI
> - [ ] 5. Load the backlog into GitHub Issues/Projects

---

## 1. Product definition

### Problem
Household admin is spread across WhatsApp messages, a notes app, Splitwise and memory. Things get forgotten (bills, chores), get bought twice (groceries) or turn into awkward conversations (who owes what).

### Users
- **Primary:** you + partner/roommates (2–5 people per household).
- **Context:** mostly on the phone, often in a supermarket with bad signal.

### Success criteria (by Oct 31)
- The household uses Casa for **all** grocery shopping for 2 weeks straight.
- 0 missed bills/chores that had a reminder set.
- Balances match a manual check of real expenses.
- Ticking an item on phone A shows up on phone B in **< 1 s**.

### Out of scope for MVP
- Native iOS/Android apps (PWA only)
- Bank connections / automatic expense import
- Receipt scanning (OCR/LLM), meal planner, chat bots
- More than one currency per household
- Public sign-up / marketing site (invite-only)

---

## 2. User stories + acceptance criteria

### Epic A — Accounts & households
| ID | Story | Acceptance criteria |
|---|---|---|
| A1 | As a user I can sign up and log in with email + password | Session cookie; logout; password reset via email |
| A2 | I can create a household | Creator becomes `owner`; household has name, currency, timezone |
| A3 | I can invite someone with a link | Link expires in 7 days, single-use; joining adds them as `member` |
| A4 | I can belong to more than one household and switch between them | Last-used household remembered |

### Epic B — Shopping list
| ID | Story | Acceptance criteria |
|---|---|---|
| B1 | Add an item (name, optional qty, note) | Shows instantly on all members' devices (< 1 s) |
| B2 | Tick/untick an item | Ticked items move to the bottom; "clear ticked" removes them |
| B3 | Autocomplete from past items | Top 8 suggestions ranked by how often you've added them |
| B4 | Items grouped by aisle/category | Category remembered per item name |
| B5 | Works offline | Changes queue locally and sync when back online, no duplicates |

### Epic C — Chores
| ID | Story | Acceptance criteria |
|---|---|---|
| C1 | Create a repeating chore (daily / weekly on days X / every N days / monthly) | Next 5 due dates preview shown |
| C2 | Assign to a person or rotate between members | Rotation advances on completion |
| C3 | Mark done / skip | History kept; next due date recalculated |
| C4 | Get a reminder when due | Push notification at due time in the household's timezone |

### Epic D — Expenses
| ID | Story | Acceptance criteria |
|---|---|---|
| D1 | Add an expense (amount, description, who paid, date, category) | Amount stored as integer cents |
| D2 | Split equally / by percent / exact amounts | Splits must add up to the total (validated server-side) |
| D3 | See balances ("Ana owes you 23.50") | Simplified to the fewest payments |
| D4 | Settle up | Records a settlement; balances update for everyone |
| D5 | Edit/delete my own expense | Balances recalculated; change shows in the activity feed |

### Epic E — Bills & subscriptions
| ID | Story | Acceptance criteria |
|---|---|---|
| E1 | Add a repeating bill (name, amount, due day, frequency) | Next due date shown |
| E2 | Reminder N days before (default 3) | Push notification; repeats on the due day if not marked paid |
| E3 | Mark paid → optionally creates an expense | One tap creates the expense |

### Epic F — App shell
| ID | Story | Acceptance criteria |
|---|---|---|
| F1 | Install on phone home screen | Valid manifest, icons, service worker |
| F2 | Enable notifications | Web Push subscription saved per device |
| F3 | Activity feed | Last 50 household events |

---

## 3. Architecture

```
               ┌──────────── Caddy (HTTPS, single domain) ────────────┐
               │   /            → static SolidJS build (PWA)          │
               │   /api/*       → Django (ASGI, uvicorn)              │
               │   /api/events  → Django SSE (async view, no buffer)  │
               └──────────────────────────────────────────────────────┘
                         │                         │
                    MongoDB 8                   Valkey 8
            (households, items, chores,   (sessions, cache, event streams,
             expenses, bills, history)     reminder schedule, rate limits)
                         ▲                         ▲
                         └──── worker (Django management command) ─── Web Push
```

### Key technical decisions

| # | Decision | Why |
|---|---|---|
| D-01 | **Same domain** for API and frontend (Caddy routes paths) | Session cookies + CSRF just work, no CORS, no JWT |
| D-02 | **Django Ninja** for the API | Typed schemas (Pydantic), auto OpenAPI docs, async support |
| D-03 | **`django-mongodb-backend`** (official) for the ORM | Keeps Django admin, auth and the ORM. Fallback if the spike fails: PyMongo directly for domain data, keep auth in MongoDB through the same backend |
| D-04 | **Valkey Streams** (not plain Pub/Sub) for live updates | Streams keep recent events, so a phone that reconnects can catch up with `Last-Event-ID`. Pub/Sub loses anything sent while offline |
| D-05 | **SSE** (not WebSockets) | Updates only go server → client; writes go through normal REST calls. Simpler, works through proxies, reconnects by itself |
| D-06 | **Money as integer cents** + household currency | No float rounding errors |
| D-07 | **Repeat rules as RFC 5545 RRULE strings** using `python-dateutil` | Standard, handles edge cases (last day of month, every other week) |
| D-08 | **Client-generated IDs + idempotency keys** for writes | Offline queue can retry safely without creating duplicates |
| D-09 | **Last-write-wins per field** using `updated_at` | Good enough for 2–5 people; no CRDTs needed |
| D-10 | Times stored in **UTC**, shown in the household timezone | Reminders fire at the right local time |

### Repo structure (monorepo)

```
casa/
├── backend/
│   ├── casa/              # settings, urls, asgi
│   ├── accounts/          # users, auth, invites
│   ├── households/        # household, membership
│   ├── shopping/          # items, catalog/autocomplete
│   ├── chores/            # chores, completions, rrule logic
│   ├── finance/           # expenses, settlements, balances, bills
│   ├── realtime/          # stream publish helper + SSE view
│   ├── notifications/     # push subscriptions, reminder worker
│   └── tests/
├── frontend/
│   └── src/
│       ├── routes/        # shopping, chores, money, bills, settings
│       ├── components/
│       ├── stores/        # Solid stores per feature
│       ├── lib/api.ts     # fetch wrapper (CSRF, idempotency key)
│       ├── lib/sync.ts    # SSE client + offline queue (IndexedDB)
│       └── sw.ts          # service worker (push + caching)
├── deploy/
│   ├── docker-compose.yml
│   ├── docker-compose.prod.yml
│   └── Caddyfile
├── .github/workflows/ci.yml
└── README.md
```

### Tooling
- **Backend:** Python 3.13, `uv` for packages, `ruff` (lint/format), `pytest-django`, `mypy` (light).
- **Frontend:** SolidJS + Vite + TypeScript, `@solidjs/router`, `vite-plugin-pwa`, Tailwind CSS, `idb` (IndexedDB), Vitest.
- **Push:** `pywebpush` with VAPID keys.
- **Infra:** Docker Compose for dev and prod; Caddy for TLS.

---

## 4. Data model (MongoDB)

> [!note] Embed vs separate collection
> Embed data that is small and always read with its parent (members, expense splits). Keep data that several people edit at the same time in its own collection (shopping items), so two phones don't overwrite each other's changes to one big document.

| Collection | Key fields | Notes |
|---|---|---|
| `users` | email, password, name, created_at | Django auth user |
| `households` | name, currency, timezone, **members[]** {user_id, role, joined_at}, created_at | Members embedded (max ~5) |
| `invites` | household_id, token, created_by, expires_at, used_at | TTL index on `expires_at` |
| `shopping_items` | _id (client-generated), household_id, name, qty, note, category, checked, checked_by, updated_at, deleted_at | Index `(household_id, checked, updated_at)` |
| `item_catalog` | household_id, name_normalized, category, times_added, last_added_at | Drives autocomplete + aisle grouping; unique `(household_id, name_normalized)` |
| `chores` | household_id, title, rrule, dtstart, assignee_mode (`fixed`/`rotate`), assignees[], rotation_index, next_due_at, active | Index `(household_id, next_due_at)` |
| `chore_events` | chore_id, household_id, user_id, action (`done`/`skip`), due_at, at | History |
| `expenses` | household_id, description, amount_cents, paid_by, date, category, **splits[]** {user_id, amount_cents}, created_by, updated_at, deleted_at | Splits embedded; validated so they add up to the total |
| `settlements` | household_id, from_user, to_user, amount_cents, at | |
| `bills` | household_id, name, amount_cents, rrule, next_due_at, remind_days_before, last_paid_at | |
| `push_subscriptions` | user_id, endpoint, keys, user_agent, created_at | Delete on 404/410 from the push service |
| `activity` | household_id, actor, type, payload, at | Capped or TTL 90 days |
| `idempotency_keys` | key, user_id, response, created_at | TTL 24 h (could live in Valkey instead) |

---

## 5. Valkey key design

| Key | Type | Purpose | TTL |
|---|---|---|---|
| `session:*` | string | Django sessions (cache backend) | 30 d |
| `hh:{id}:stream` | **stream** | Live events for SSE; `XADD MAXLEN ~ 1000` | — |
| `reminders` | **sorted set** | member = `chore:{id}` / `bill:{id}`, score = due timestamp (UTC) | — |
| `hh:{id}:balances` | hash | Cached balances; deleted whenever an expense/settlement changes | 1 h |
| `hh:{id}:catalog:top` | sorted set | Autocomplete ranking (`ZINCRBY` on add) | — |
| `idem:{user}:{key}` | string | Idempotency response cache | 24 h |
| `rl:{ip or user}:{route}` | counter | Rate limiting (login, invites) | 60 s |
| `lock:reminder:{id}` | string `SET NX PX` | Stops the same reminder being sent twice if two workers run | 60 s |

### Reminder worker loop
1. Every 15 s: `ZRANGEBYSCORE reminders -inf now LIMIT 0 100`.
2. For each: take the lock → send push to the assigned users → `ZREM` → work out the next occurrence → `ZADD` the new score.
3. On startup: rebuild `reminders` from MongoDB (`next_due_at`), so Valkey can be wiped without losing anything. **MongoDB is the source of truth; Valkey is rebuildable.**

### Live update flow
1. `PATCH /api/shopping/items/{id}` → write to MongoDB → `XADD hh:{id}:stream * type item.updated data {...}`.
2. SSE view: `XREAD BLOCK 15000 STREAMS hh:{id}:stream <last-id>` → sends events with `id:` = stream ID.
3. Phone reconnects → browser sends `Last-Event-ID` → server replays what it missed. If that ID was already trimmed away → send `resync` → client reloads the full list.

---

## 6. API design (REST, `/api/v1`)

| Method | Path | Notes |
|---|---|---|
| POST | `/auth/signup`, `/auth/login`, `/auth/logout` | Session cookie |
| GET | `/auth/me` | Current user + households |
| POST | `/households` | Create |
| POST | `/households/{id}/invites` | Returns link |
| POST | `/invites/{token}/accept` | Join |
| GET | `/households/{id}/events` | **SSE stream** |
| GET/POST | `/households/{id}/shopping/items` | List / create (client id) |
| PATCH/DELETE | `/shopping/items/{id}` | Update / soft delete |
| POST | `/households/{id}/shopping/clear-checked` | |
| GET | `/households/{id}/shopping/suggest?q=` | Autocomplete |
| GET/POST | `/households/{id}/chores` | |
| PATCH/DELETE | `/chores/{id}` | |
| POST | `/chores/{id}/complete`, `/chores/{id}/skip` | |
| GET/POST | `/households/{id}/expenses` | Paginated |
| PATCH/DELETE | `/expenses/{id}` | |
| GET | `/households/{id}/balances` | Cached |
| POST | `/households/{id}/settlements` | |
| GET/POST | `/households/{id}/bills` | |
| POST | `/bills/{id}/paid` | `?create_expense=true` |
| POST/DELETE | `/push/subscriptions` | |
| GET | `/households/{id}/activity` | Last 50 |

Rules: every write accepts an `Idempotency-Key` header; every household route checks membership; errors use a single JSON format `{code, message, details}`.

---

## 7. UI plan (mobile-first)

Bottom tab bar: **List · Chores · Money · Bills · More**

| Screen | Main elements |
|---|---|
| Shopping list | Sticky input with autocomplete at top, items grouped by aisle, swipe/tap to tick, "clear ticked", offline indicator |
| Chores | "Today / This week / Later" sections, avatar of assignee, big ✓ button, skip in menu |
| Chore editor | Title, repeat picker (presets + custom), assignee/rotation, preview of next 5 dates |
| Money | Balance card at top ("You're owed 42.10"), settle-up button, expense list, + button |
| Expense editor | Amount keypad, description, paid by, split mode tabs (equal / % / exact) |
| Bills | Upcoming list with days-left badge, mark paid |
| More | Household switcher, members + invite link, notifications toggle, activity feed, logout |

**Next step:** low-fidelity wireframes for these 7 screens (paper or Figma) before week 1 ends.

---

## 8. Week-0 spikes (Oct 4–5) — reduce risk before building

| Spike | Question | Pass when… |
|---|---|---|
| S1 | Does `django-mongodb-backend` work with Django auth, admin, sessions and Django Ninja on the Django version it currently supports? | Signup/login + admin CRUD work against MongoDB |
| S2 | Can a Django async SSE view + Valkey `XREAD BLOCK` push updates to 2 browser tabs in < 1 s behind Caddy? | Tick in tab A → tab B updates; reconnect replays missed events |
| S3 | Does Web Push work on your actual phones (Android Chrome, iPhone PWA installed to home screen)? | Test notification arrives on every household phone |
| S4 | Does `dateutil.rrule` cover the repeat rules you need, in your timezone? | Unit tests for "every other Tue", "last day of month", daylight-saving change |

Write each result into this doc (✅ / ❌ + note). If S1 fails → switch to fallback D-03. If S3 fails on iPhone → add Telegram bot notifications to the MVP.

---

## 9. Milestones & backlog by week

| Week | Dates | Milestone | Stories |
|---|---|---|---|
| 0 | Oct 4–5 | Planning done, spikes run | This doc, S1–S4, repo + CI skeleton |
| 1 | Oct 6–12 | **M1: Shopping list in daily use** | A1, A2, A3, B1, B2, B3, F1 + deploy to server |
| 2 | Oct 13–19 | **M2: Chores + reminders** | C1–C4, F2, B4, reminder worker |
| 3 | Oct 20–26 | **M3: Money** | D1–D5, E1–E3, F3 |
| 4 | Oct 27–31 | **M4: Solid v1** | B5 (offline), A4, polish, backups, bug fixes from real use |

> [!tip] Deploy in week 1, not week 4
> Putting it on the real server at M1 means the household starts using it and finds bugs early.

---

## 10. Quality, testing & ops

- **Definition of done (per story):** acceptance criteria pass · tests written · works on a phone screen · deployed to the server.
- **Backend tests:** pytest-django against real MongoDB + Valkey in Docker. Most effort on balance math, splits, repeat rules, permissions (user can't see another household's data).
- **Frontend tests:** Vitest for stores/sync logic; manual check on 2 real phones per milestone.
- **CI (GitHub Actions):** ruff + pytest (with service containers) + frontend typecheck/test/build on every push.
- **Security:** CSRF on, secure cookies, rate limit on login/invites, household membership checked on every route, invite tokens random + single-use.
- **Backups:** nightly `mongodump` to off-server storage; test a restore once in week 4. Valkey needs no backup (rebuildable).
- **Monitoring:** Django logs + a `/api/health` endpoint (MongoDB + Valkey ping); optional Sentry free tier.

---

## 11. Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| `django-mongodb-backend` doesn't work with a package you need | Med | High | Spike S1; fallback D-03 |
| iPhone push unreliable | Med | Med | Spike S3; Telegram fallback |
| Offline sync bugs (duplicates, lost edits) | Med | Med | Idempotency keys, client IDs, offline left to week 4 |
| Scope creep (receipt OCR, meal plans…) | High | Med | "Later" list in [[2026-10-04-casa-household-hub]]; nothing new until M4 |
| Not enough evening time | Med | High | Week 1 milestone alone is already useful; cut E (bills) before D (expenses) |

---

## 12. Open questions (need your answer)

| # | Question | Default if not answered |
|---|---|---|
| Q1 | Who's in the household and what phones do they use (iPhone/Android)? | 2 people, one of each |
| Q2 | App language: English, Spanish or both? | English UI, set up for translations later |
| Q3 | Currency and timezone? | One currency per household, chosen at creation |
| Q4 | Where will it run: a VPS (Hetzner/DigitalOcean), a home server, or Railway/Fly.io? | Small VPS + Docker Compose + Caddy |
| Q5 | Domain name? | Subdomain of a domain you already own |
| Q6 | Email for password reset: which provider (Resend, Postmark, SMTP)? | Resend free tier |
| Q7 | Should expenses support categories from day 1? | Yes, a fixed list of 8 |

## Key Takeaways

- Plan first: define the product, freeze the data model, then run 4 small spikes (MongoDB backend, live sync, phone notifications, repeating schedules) before writing feature code.
- MongoDB is the source of truth; Valkey (streams, sorted sets, cache) can always be rebuilt from it.
- Live updates use Valkey Streams + SSE so phones that reconnect catch up on what they missed.
- Ship the shopping list to the real server by Oct 12 and let daily use guide the rest.
