# Body Buddy — project notes for Claude

繁體中文 mobile-first PWA on Cloudflare (Worker + D1 + R2 + Access). UI strings
are Traditional Chinese; code/comments English.

## Commands

- `npm run typecheck` — both tsconfigs (worker `src/`, frontend `web/`)
- `npm test` — vitest unit tests (gamify rules in `src/gamify.test.ts`)
- `npm run dev` — build web + `wrangler dev` on :8787 (identity from `.dev.vars` DEV_USER_EMAIL; no Access locally)
- `npm run db:migrate:local` / `db:migrate:remote`

## Deploying

**Commit + push to `main` is the deploy path** — CI typechecks, tests, applies
D1 migrations, then deploys. Do not run `npm run deploy` manually. Worker
secrets (`MISTRAL_API_KEY`/`OPENROUTER_API_KEY`, `VAPID_PRIVATE_KEY`) are set
once via `wrangler secret put` and survive deploys.

## Versioning & changelog

App version is `v0.0.x`, bumped once per shipped **milestone** (main feature),
not per commit. When shipping one, update all three together:
`CHANGELOG.md` (detailed English entry), `package.json` `version`, and
`web/src/version.ts` (`APP_VERSION` + a short 繁中 `VERSION_HISTORY` entry —
this drives the in-app 關於 page). Also refresh the README Features section
if the feature is user-visible.

## Architecture decisions (non-obvious)

- **Dates**: the client always passes its local `date=YYYY-MM-DD` to the API;
  the server never derives "today" (timezone drift). `food_logs.created_at` is
  UTC; reminder windows in `src/push.ts` convert Asia/Taipei explicitly.
- **Gamification is derived on read** (`src/gamify.ts`): no XP event log.
  XP/level/streak/journey are recomputed from `food_logs`/`workout_entries`/
  `inbody_records` each request, so edits and deletes self-heal, and changing
  the 最低/目標 settings retroactively rescores history (intended). Imported
  InBody rows (`source='import'`) earn no XP. The streak rule: day qualifies
  when logged AND protein ≥ `protein_min_g` (default 75% of `protein_target_g`);
  an unfinished today never breaks the chain. Rule changes must keep
  `xpByDate` as the single source shared by totals and journey, and be
  reflected in `src/gamify.test.ts`.
- **Auth**: Cloudflare Access authenticates (JWT verified in `src/auth.ts`);
  the app authorizes — membership comes from invite links (`#/admin`, admin
  only, APIs 403 server-side). `OWNER_EMAILS` claims data + admin on first login.
  The main Access application's policy is intentionally **Allow → Everyone**
  (any Google login passes the edge), NOT an email allowlist: authorization is
  the app's job (a non-member authenticates fine but gets 403 `invite_required`
  on every endpoint except invite redeem). Do NOT re-add a Cloudflare email
  allowlist — it would force adding each invitee to Access by hand and defeats
  the invite system. "Allow Everyone" still requires login; only the `/welcome`
  Bypass app skips it (see Public surface below).
- **Public surface**: Access guards the whole app at the edge, so the two
  public paths — `GET /welcome` (self-contained landing HTML in `src/landing.ts`,
  no dependency on protected assets) and `POST /api/waitlist` — only work if
  they're **Bypass**ed in an Access application (see README). `authMiddleware`
  early-returns for `POST /api/waitlist`; `/welcome` is in wrangler
  `run_worker_first` so the Worker (not the SPA fallback) serves it. Admin
  waitlist management lives in the `invite` router (already admin-gated).
- **Invite email** (`src/email.ts`): raw SMTP to `smtp.gmail.com:465` over
  `cloudflare:sockets` (implicit TLS, `AUTH LOGIN` with a Gmail App Password;
  port 25 is blocked, 465 isn't). No deps. Chosen over Mailgun because the
  Mailgun free tier is sandbox-only (delivers just to pre-authorized
  recipients) without a custom domain; Gmail SMTP delivers to anyone. Sending
  is a no-op when `GMAIL_APP_PASSWORD` is unset and best-effort otherwise — a
  failure still records the invite and the admin UI falls back to a copyable link.
- **Web Push**: subscriptions per device in `push_subscriptions`; cron
  `30 1,5,11 * * *` UTC = 09:30/13:30/19:30 Taipei meal checks. Push is a
  silent no-op when `VAPID_PRIVATE_KEY` is unset. iOS requires the installed
  (Home-Screen) PWA.
- **Frontend**: no framework — `h()` helper (`web/src/ui.ts`), hash routing in
  `web/src/main.ts`, one file per page in `web/src/pages/`. Charts are the
  hand-rolled SVG `lineChart` in `web/src/chart.ts`.
- **UI system — reuse the shared primitives, don't hand-roll**: cards are
  `.card`; section labels are `.eyebrow` (small grey uppercase). For any
  tappable card row that navigates to another page OR toggles a section open,
  use `cardLink(label, {href})` / `cardLink(label, {onclick, trailing})` from
  `web/src/ui.ts` (renders `.card.card-link` — accent + semibold, emoji lead,
  arrow pinned right: "→" for nav, "▼/▲" for a toggle). This is the canonical
  "go / reveal" affordance (settings 管理後台 & 加入主畫面, InBody 歷史紀錄).
  Colors come from CSS vars in `web/src/style.css` (`--accent`, `--ink`/`-2`/
  `-3`, `--line`, `--data`) — never hard-code hex; both light & dark are
  defined there. Prefer a class in `style.css` over per-element inline `style`
  when a pattern repeats.

## Verification pattern

For gamify/reminder logic: unit tests first (`npm test`). For API behavior:
seed the local D1 (`wrangler d1 execute body-monitor-db --local --command ...`
with `raw_text='seed'` rows, user_id 1), hit the API via `wrangler dev`, then
delete the seed rows. The cron handler can be triggered locally with
`curl http://localhost:8787/cdn-cgi/handler/scheduled?cron=...`
(`/__scheduled` is shadowed by the SPA asset fallback). Prod data checks:
`wrangler d1 execute body-monitor-db --remote` (the API itself sits behind
Access and isn't curl-able).
