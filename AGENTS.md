# AGENTS.md

## Project Overview

Bottlepass (package name: `oaa-server`) is the API server for **Open Angel Arena (OAA)**, a Dota 2 custom game mode. It serves two consumers:

1. **Dota 2 game instances** -- running OAA games call this server during match lifecycle events (auth, team assignment, draft, state save/load, match completion). These calls are authenticated via HMAC shared secret + JWT.
2. **A web UI** -- consumes read-only data (profiles, leaderboards, match history, active matches, tournament seedings). Users authenticate via Steam OpenID to access team management features.

The server calculates **MMR** (a modified Elo system for 5v5) and awards **Bottlepass XP** (a progression/leveling system that rewards playing games).

## Architecture

- **Runtime**: Node.js, plain `http`/`https` modules (no Express/Koa/Hapi)
- **Routing**: `http-hash-router` -- hash-trie URL router
- **Database**: LevelDB via `level` -- one DB instance per model, stored under `{root}/db/`
- **Config**: `rc` module reads `.oaaserverrc` files (standard rc search paths)
- **Auth**: `sha.js` for HMAC checksums, `jsonwebtoken` for JWTs, `steam-auth` for Steam OpenID
- **Validation**: `joi` schemas enforce data shape on every model read and write
- **CORS**: `corsify` middleware allows `Authorization`, `X-Auth-Token`, `Content-Type`, `Auth-Checksum`
- **Errors**: All errors normalize to `boom` HTTP errors; sent via `send-boom`

Entry point: `index.js` requires `src/index.js`, which loads config defaults and calls `src/init.js` to create the server and wire routes.

## Authentication

There are three auth mechanisms. Understanding them is critical.

### 1. HMAC Shared Secret (Game Instance → Server)

Used only on `POST /auth` (match registration). The game instance and server share an `authkey` that is **never sent over the wire**:

- The client serializes the request body to a string
- Computes `SHA-256(bodyString + authkey)`
- Sends the hash in the `Auth-Checksum` header
- The server computes the same hash and compares

If valid, the server issues a **match JWT** (`type: 'match'`, contains `matchid`).

### 2. Match JWT (Subsequent Game Server Calls)

All `/match/*` and `/state/*` endpoints use `src/auth.js` middleware (`AuthRequired`). The JWT is read from the `X-Auth-Token` header, verified with `options.secret`, and `req.auth` / `req.matchid` are populated.

### 3. Steam OpenID (Web Users)

`/auth/authenticate` redirects to Steam login. `/auth/verify` handles the callback, creates/fetches the user, and issues a **user JWT** (`type: 'user'`, contains full user object). Used by `/team/*` and `/admin/*` endpoints.

## Data Layer

All models live in `src/models/`. The base abstraction (`model.js`) wraps LevelDB with Joi validation:

`CreateModel(JoiSchema, idKeyName, leveldbInstance)` → `{ get, put, getOrCreate, createReadStream }`

Every read and write passes through Joi validation. Joi defaults auto-fill missing fields, which serves as a migration mechanism for schema additions.

### Models

| Model | Key | Purpose |
|-------|-----|---------|
| **Users** | `steamid` | Player state: MMR, bottlepass level/XP, match history, hero picks/bans, abandon penalties |
| **Match** | `id` (HMAC of startTime + players) | Game records: players, teams, draft, outcome, timing |
| **MatchState** | `id` (HMAC of player+hero composition) | Live game state snapshots for crash recovery |
| **Profile** | `steamid` | Cached Steam profile data (name, avatar); auto-fetches from Steam API if stale >24h |
| **MMRBracket** | `bracket` (page number) | Leaderboard pages of 5000 players each, rebuilt on demand |
| **Seasons** | `"state"` / season number | Season state machine + historical top-100 snapshots |
| **Team** | `id` (UUID) | Tournament team rosters with invite codes |
| **HeroPopularity** | `months` (string integer) | Cached most-picked/banned hero lists per time window |

### Key Model Patterns

- **Decorator wrapping**: Users model wraps `get`/`getOrCreate` with `adjustMMR` (caps MMR for players with <20 matches). `addUserProperty` layers joined data from Profile and Team onto user reads, stripping it on writes.
- **Full table scans**: `createReadStream` is used for leaderboard calculation, finding teams by invite code, and season resets. These are async streams wrapped in Promises.
- **Deterministic IDs**: Match IDs and state IDs are HMAC-SHA256 hashes of their constituent data, making them reproducible and idempotent.

## API Surface

### Game Server Endpoints (called by Dota 2 instances)

| Route | Method | Auth | Purpose |
|-------|--------|------|---------|
| `/auth` | POST | HMAC checksum | Register a match, get JWT |
| `/match/send_teams` | POST | Match JWT | Lock in team assignments |
| `/match/send_bans` | POST | Match JWT | Record hero bans |
| `/match/send_heroes` | POST | Match JWT | Record hero picks |
| `/match/unpopular_heroes` | POST | Match JWT | Get auto-ban list for least-played mode |
| `/match/calculate` | POST | Match JWT | Preview win odds (Elo expected score) |
| `/match/complete` | POST | Match JWT | End match, update MMR + bottlepass XP |
| `/state/save` | POST | Match JWT | Save live game state (also registers in active matches) |
| `/state/load` | POST | Match JWT | Load saved state for crash recovery |

### Web/User Endpoints

| Route | Method | Auth | Purpose |
|-------|--------|------|---------|
| `/auth/authenticate` | GET | None | Redirect to Steam login |
| `/auth/verify` | GET | None | Steam OpenID callback → user JWT |
| `/auth/token` | GET | User JWT | Refresh user JWT |
| `/users/:steamid` | GET | None | Player profile |
| `/matches/:id` | GET | None | Match details |
| `/active_matches` | GET | None | Currently running games (5-min timeout) |
| `/hero_popularity` | GET | None | Most picked/banned heroes (cached, `?months=N`) |
| `/top{N}` | GET | None | Leaderboard (paginated by N) |
| `/history` | GET | None | Previous season top players |
| `/tournament` | GET | None | Tournament seedings (JSON) |
| `/tournament.csv` | GET | None | Tournament seedings (plain text) |
| `/team/*` | GET/POST | User JWT | Team CRUD, invites, roster management |

### Admin Endpoints

| Route | Method | Auth | Purpose |
|-------|--------|------|---------|
| `/admin/impersonate` | GET | User JWT + isAdmin | Get JWT for any user |

## Match Lifecycle

A typical game flows through these calls in order:

1. **`POST /auth`** -- Game registers players, gets match JWT
2. **`POST /match/send_teams`** -- Teams are assigned (dire/radiant)
3. **`POST /match/unpopular_heroes`** -- (optional) Get auto-ban list
4. **`POST /match/send_bans`** -- Bans are recorded
5. **`POST /match/send_heroes`** -- Picks are recorded
6. **`POST /match/calculate`** -- (optional) Get win probability
7. **`POST /state/save`** -- Periodic state snapshots during gameplay
8. **`POST /match/complete`** -- Game ends, MMR and XP are calculated

## MMR System

Modified Elo for 5v5. Core logic in `src/mmr.js`.

- **Elo function**: `1 / (1 + 10^((opponent - self) / 400))`
- **K-factor** scales by MMR bracket: 80 (<1000), 40 (1000-1500), linear 40→20 (1500-2000), 20 (2000+)
- **Team scores**: Average team MMR determines expected outcome. Individual MMR change is weighted by how far a player's MMR is from their team average.
- **Loss dampening**: Lower-rated players lose less (0.5x below 1000, 0.75x at 1000-1500, 0.9x at 1500-2000)
- **New player cap**: Players with <20 matches have MMR capped at `980 + matchesFinished * 5`

## Bottlepass XP

Awarded on match completion. 100 XP per level, level cap 100 (with prestige reset).

- 1 XP per 2 minutes of game time
- 20-30 random bonus XP if game > 25 minutes
- +5 first game of the day, +5 first win of the day
- 1.5x multiplier for lobby host
- 2x multiplier if a new player (≤3 games) is in the lobby
- Abandon penalty: +2 penalty games per abandon, -1 per completed game; no XP while serving penalty

## Seasons

Managed by `src/season.js`. When a new season triggers (`precallibration` state):

1. Snapshot top 100 players from the ending season
2. Compress all player MMR into a 700-1400 range using a cubic distribution curve
3. Transition to `running` state and rebuild the leaderboard

## Configuration

`.oaaserverrc` (loaded by `rc`, gitignored):

| Key | Purpose |
|-----|---------|
| `port` | HTTP listen port (default: 6969) |
| `ssl_port` | HTTPS listen port (optional, needs `cert.pem` + `privkey.pem`) |
| `root` | Data directory for LevelDB (default: `../data/`) |
| `secret` | JWT signing key |
| `authkey` | Shared HMAC key for game instance auth |
| `steamkey` | Steam Web API key |
| `baseurl` | Server's public URL |
| `weburl` | Web UI URL (for OAuth redirects) |
| `currentSeason` | Active season number |
| `imba.*` | RabbitMQ config for IMBA cross-game cosmetics (currently disabled) |

## Development

- **Install**: `yarn install` or `npm install`
- **Run**: `npm start` (or `node index.js`)
- **Test**: `npm test` (runs `tape` tests + `semistandard` linter)
- **Code style**: `semistandard` (StandardJS with semicolons), 2-space indent, LF line endings
- **Test approach**: Integration tests using real LevelDB on disk (in `test/` directory), using `tape` with TAP output piped to `tap-spec`

To test locally against OAA, edit the URL in [bottlepass/server.lua](https://github.com/OpenAngelArena/oaa/blob/master/game/scripts/vscripts/components/bottlepass/server.lua#L12) in the OAA repo to point at your local server.

## File Layout

```
index.js                    Entry point (requires src/)
src/
  index.js                  Config defaults + init
  init.js                   HTTP server creation + route wiring
  auth.js                   JWT auth middleware (AuthRequired HOF)
  mmr.js                    Elo/MMR calculation functions
  season.js                 Season transitions + MMR redistribution
  imba.js                   RabbitMQ integration (currently disabled)
  test.js                   Integration test harness
  endpoints/                Route handlers (one file per endpoint group)
  models/
    model.js                Base LevelDB + Joi model abstraction
    index.js                Model factory + dependency wiring
    users.js, match.js, matchstate.js, profile.js,
    brackets.js, seasons.js, team.js, hero_popularity.js
data/db/                    LevelDB storage (gitignored)
teams.csv                   Tournament team rosters
.oaaserverrc                Runtime config (gitignored)
```
