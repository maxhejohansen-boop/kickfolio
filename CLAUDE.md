# Kickfolio

A football player "stock market" game. Users get a starting balance, buy and sell shares in
Premier League players, and prices move after each simulated matchday based on the players'
stats. React SPA on Vite, Supabase for auth/data/realtime/edge functions, deployed on Vercel.

## Commands

```bash
npm install
npm run dev        # Vite dev server
npm run build      # production build to dist/
npm run preview    # serve the built output
npm run lint       # oxlint (config in .oxlintrc.json)
```

No test suite exists. `playwright` is in devDependencies but nothing uses it yet — don't
assume there are tests to run, and don't add a test command to package.json without asking.

## Environment

`.env.local` at the repo root, modelled on `.env.example`:

```
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

Anything read in the browser must be prefixed `VITE_`. The service role key is **never** used
in `src/` — only inside Supabase edge functions, where it comes from `Deno.env`.

## Architecture

**Frontend** — `src/`, plain JSX (no TypeScript), React 19, React Router 7, Tailwind 3, Recharts.

- `App.jsx` — all routes. `ProtectedRoute` gates `/portfolio`, `/scouting`, `/inbox`.
  `/` renders `Landing` when logged out, redirects to `/inbox` when logged in.
- `lib/supabase.js` — the single Supabase client. Everything imports this one.
- `lib/AuthContext.jsx` — `user` (auth user) and `userRecord` (row in `public.users`, holds
  `balance` and `tutorial_completed`). Subscribes to realtime UPDATEs on the user's own row,
  so balance updates itself after trades, limit fills and matchday payouts — prefer letting
  that fire over calling `refreshUserRecord()`.
- `lib/TutorialContext.jsx` — 13-step guided tour with the character **Bobby**. Progress is in
  `localStorage` under `kickfolio_tutorial_step`, plus `users.tutorial_completed` in the DB.
  `STEP_ROUTES` maps each step to the route it navigates to; step 7 is interactive and
  deliberately does not force-redirect.
- `lib/gradeCalc.js` — the Scouting A/B/C/D valuation grades and suggested stake sizes.
- `pages/` — Landing, Login, Signup, Market, Portfolio, Leaderboard, Scouting, Inbox, Live, Admin.
- `components/` — Navbar, PlayerCard, PlayerModal (the big one, ~1000 lines: price chart,
  buy/sell, limit orders), TutorialOverlay, MatchdayPill, BillWarning, ErrorBoundary.

**Backend** — Supabase.

Core tables: `players`, `price_history`, `users`, `portfolios`, `matchday_stats`,
`matchday_tracker` (single row holding `current_matchday`), `limit_orders`,
`matchday_status` (single row: scheduled/live/finished), `live_ticks`, `dividend_payments`,
`player_scouts`, `scouting_focuses`, `inbox_messages`.

RLS is on everywhere. Public-read for game data (`players`, `price_history`,
`matchday_stats`, `matchday_status`, `live_ticks`, and `users` so the leaderboard works);
own-row-only for `portfolios`, `limit_orders`, scouting and dividends.

Realtime channels are used heavily — `matchday_status`, `live_ticks`, `players`,
`inbox_messages` and `users` are all in the `supabase_realtime` publication, and
`inbox_messages` / `users` have `REPLICA IDENTITY FULL` so payloads carry the whole row.

RPCs: `get_leaderboard()`, `send_welcome_inbox_message()`, `respond_to_interview()`.

**Edge functions** — `supabase/functions/`, Deno + TypeScript.

- `run-matchday` — the batch simulation. Generates fixtures between the six game clubs,
  rolls per-player stats, writes `matchday_stats`, moves prices, fills limit orders,
  bumps `matchday_tracker`, sends inbox summaries. Invoked from the Admin page with
  `{ simulate: true }`.
- `start-live-matchday` — the daily 15:00 Europe/Lisbon live version. Drip-feeds `live_ticks`
  so the Live page animates prices in real time, pays dividends, resolves scouting focuses.
  Self-guards with `isMatchdayWindow()` (15:00–15:09 Lisbon).

Deploy them with `supabase functions deploy <name>`.

## Domain rules worth knowing

- **Prices** start from `seed.sql` / `season_seed.sql` and only ever move through a matchday
  run. `price_history` gets one row per player per matchday; matchday 0 is the starting price.
- **Grades** (`gradeCalc.js`): replay the last 5 matchdays' price changes forward from the
  price before that window, compare the result to the current price. `priceDiff >= 15` and
  80%+ minutes → A, `>= 8` → B, `<= -8` or under 30% minutes → D, else C. Suggested stake is
  5/3/1/0% of balance.
- **Dividends** are per-share cash paid on minutes, goals, assists, clean sheets and rating,
  weighted by position (see `dividendPerShare` in `start-live-matchday`).
- **Scouting** costs money per matchday per active focus, which is why `BillWarning` exists —
  a user can go negative if focuses outrun their balance.
- **DNP** — players who don't play get a flavour reason from `DNP_REASONS` and a price penalty.
- The interview/media feature is built but disabled (commit `eaad5b0`); the code is kept
  intentionally. Don't delete it as dead code.

## Conventions

- JSX only. If you want types, ask first — adding TypeScript is a project decision, not a refactor.
- Tailwind utility classes inline. Theme colors are in `tailwind.config.js`
  (`bg #0a0b0e`, `surface`, `card`, `border`, `muted`, `accent #22c55e`); the dark palette and
  the green accent are the whole visual identity. Football-Manager-inspired dense UI.
- Keyframe animations live in `src/index.css` (`live-flash-*`, `tutorial-*`), not inline.
- New DB changes go in `supabase/migrations/` as `YYYYMMDD_<name>.sql`, and must include
  their RLS policies in the same file.

## Known traps

1. **The repo cannot rebuild the database.** `inbox_messages` is queried all over `src/` but
   is created in no committed migration, and `respond_to_interview()` is called from
   `Inbox.jsx` but defined nowhere in the repo. Some schema was applied by hand in the
   Supabase SQL editor. Before relying on `schema.sql` + `migrations/` as the source of
   truth, dump the live schema and backfill the missing migrations.
2. **Two different pricing formulas.** `run-matchday`'s `calcChangePct` (goals ×5, assists ×3,
   clamp ±15) and `start-live-matchday`'s (goals ×8, assists ×5, clamp −20/+30) disagree, and
   `gradeCalc.js` mirrors the `run-matchday` one. So Scouting grades are computed against the
   batch formula while live matchdays move prices on the other. Changing one means changing
   all three — or better, unifying them.
3. **The daily cron is not in code.** The `pg_cron` schedule that calls `start-live-matchday`
   is commented out at the bottom of `20260705_live_matchday.sql` and has to be created by
   hand in the SQL editor. There are two entries because Lisbon shifts between UTC+0 and +1.
4. **`/admin` is only login-gated**, not role-gated — any signed-in user who guesses the URL
   can trigger a matchday.
5. **A Supabase URL and anon key are hardcoded** in `seed_season.cjs`. It's the anon key, not
   the service role key, but it shouldn't be committed.
6. `README.md` is still the untouched Vite template.

## Seed scripts

- `generate_sql.cjs` → `node generate_sql.cjs > season_seed.sql`, writes a deterministic
  (seed 42) full 38-matchday 2025/26 season of stats and prices.
- `seed_season.cjs` pushes the same data straight to Supabase over the JS client.
- Per-club squads are in `supabase/migrations/2026062*_*_squad.sql`.

Both scripts are destructive to game state. Never run them against the live project without
being asked to.
