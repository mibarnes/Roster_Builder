# AGENTS.md — Roster_Builder (project scope)

Layers on top of `~/.AI_TOOLS/AGENTS.md`. Global conventions apply unless overridden here.

## Workspace note
This project lives under **`~/.AI_APPS/`** — a **new workspace class** not yet formalized in the
global contract (which defines only `.AI_PROJ` / `.AI_ADMIN`). `.AI_APPS` is for deployable
**applications** (vs analysis projects / personal admin). It follows the standard per-project
4-file contract (README / AGENTS / PLAN / LESSONS). Formalizing `.AI_APPS` in the global
AGENTS.md §6 is a deferred governance note (see PLAN.md).

## Toolchain (hard rules)
- **pnpm only — no npm.** Per global §12. CI uses corepack + `pnpm install --frozen-lockfile`.
  `scripts/guard-no-npm.sh` is vendored for CI and gates against `package-lock.json`/yarn lock.
- **TypeScript strict.** `noUncheckedIndexedAccess` is on — the data-join code handles many
  optional fields, so expect `| undefined` and guard accordingly.
- **zod at every data boundary.** Source adapters validate raw → canonical with zod; the pipeline
  trusts validated shapes downstream. Don't widen with `as any` to dodge a schema mismatch — fix
  the schema or the data.
- Node version pinned in `.node-version` (fnm auto-switches).

## Data & secrets
- **CFBD API key** lives in gitignored `.env` (`CFBD_API_KEY`) with a durable copy at
  `~/.config/ai-secrets/roster_builder/cfbd.env`. It is consumed **only by the Node collectors
  in `scripts/`** — **never** prefix it `VITE_` and never read it from browser code, or it lands
  in the client bundle. The user has chosen to **keep** this key (not rotate). Treat it as the
  core key; never commit it; never print it in full.
- **Real data only.** When (re)collecting, only commit genuine pipeline captures — never
  mock/placeholder or randomized data into `src/data/collected/`. Mock data belongs in
  `src/data/mock/` and must be clearly labelled as such.
- **Pilot scope.** Live re-collection targets **only Florida + Miami**. Do not fire the
  collector across all 34 teams without explicit user approval (rate limits + scraper fragility).

## Deploy
- Vite `base` is env-driven (`VITE_BASE`). Never hardcode `/Roster_Builder/` back into
  `vite.config.ts`.
- Repo reconnects to the **public** `mibarnes/Roster_Builder`. Pushing replaces a public build —
  per global §11, **confirm before pushing** and scrub secrets first (`.env` untracked, key absent
  from `dist/`).

## Porting source
The recovered build to port from is in **`_recovered/backup_frontier/`** (gitignored, local).
It is the richer "frontier" copy (34 teams, 3 extra components) — prefer it over the old GitHub
`main` state (retrievable via `git show main:<path>`). See RESTORATION.md for the file-by-file map.
