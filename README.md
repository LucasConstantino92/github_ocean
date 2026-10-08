# GitHub Ocean

GitHub Ocean is a navigable 3D world where public GitHub profiles become captains, ships, and evolving island ports.

Search for a developer to visit their port, inspect their featured repositories, or sign in with GitHub to sail your own ship through the world. The visual progression is deterministic: the same public profile produces the same ship, port layout, colours, and upgrades everywhere in the application.

## Highlights

- Interactive Three.js ocean built with React Three Fiber.
- GitHub OAuth login; tokens stay on the server.
- Persistent PostgreSQL world with stable port coordinates.
- Chunk-based loading for nearby ports.
- First-person-style ship navigation with WASD, right-mouse orbital camera, and scroll zoom.
- Search travel mode for visiting another developer's port.
- Clickable repository buildings and progression details.
- Local-time lighting and lightweight, changing weather.
- Detailed ports with wandering residents, a dockside merchant, and night lanterns.
- First-party product analytics plus optional Vercel Web Analytics.

## What public GitHub data is used

The application reads public profile and repository data:

- Public repository count and follower count.
- Repository stars, forks, language, update date, name, and description.
- Authored commits from the profile owner in up to eight featured repositories.

No private repositories, private contribution data, or GitHub access tokens are stored in the browser.

### Featured repository sample

The API reads up to 100 public repositories. It selects the eight featured repositories by stars, then by most recent update. For those eight repositories, it queries GitHub commits filtered by the profile owner.

That makes the commit metric an observed sample of authored work. It is not presented as the person's total lifetime contribution count. If GitHub cannot provide a commit value, it remains unmeasured and awards no activity points.

## Progression model

All progression is calculated in `shared/progression.ts`, which is used by both the API and the 3D client. This prevents a searched profile and the same profile loaded from a world chunk from receiving different visuals.

### Overall score

The overall score ranges from 0 to 100 and combines five capped axes:

| Axis | Weight | Input | Ceiling used for balancing |
| --- | ---: | --- | ---: |
| Projects | 30% | Public repositories | 200 |
| Activity | 30% | Confirmed authored commits in the sample | 10,000 |
| Recognition | 20% | Stars in the sampled repositories | 5,000 |
| Community | 15% | Forks + followers × 0.25 | 1,500 |
| Diversity | 5% | Distinct repository languages | 12 |

Each axis uses a logarithmic cap:

```text
axisPoints = min(100, 100 × log(1 + value) / log(1 + ceiling))
```

This rewards early growth while avoiding giant visual gaps between established profiles. The score is a game-balancing value, not a professional ranking of a developer.

### Ship progression

The ship grows gradually rather than switching between only a few preset models.

| Score | Ship class |
| ---: | --- |
| 0–14 | Skiff |
| 15–31 | Sloop |
| 32–51 | Brigantine |
| 52–74 | Frigate |
| 75–100 | Galleon |

Projects extend the hull and cabin, stars improve trim and decorative details, forks add cargo, and languages determine the sail palette. The GitHub login deterministically chooses wood tone and sail pattern.

Masts unlock at scores 24, 48, and 76, for a maximum of four masts. Extra upper sails unlock with 50, 250, 1,000, and 4,000 confirmed authored commits, limited to one extra sail per mast.

### Crew progression

Crew is based only on confirmed authored commits in the featured-repository sample:

| Confirmed commits | Crew |
| ---: | ---: |
| 0–9 | 1 captain |
| 10–49 | 2 people |
| 50–149 | 3 people |
| 150–399 | 4 people |
| 400–999 | 5 people |
| 1,000–2,499 | 6 people |
| 2,500–5,999 | 7 people |
| 6,000+ | 8 people |

### Island and port progression

Each port is a deterministic archipelago, rather than a uniformly scaled mesh or a rectangular board. Buildings are placed on solid land across its individual islands. The design keeps the island radius below six world units, while ports are reserved at least 12 units apart.

The general island level is:

```text
islandLevel = 1 + floor(overallScore / 10)
```

The score also selects an evolving coastline:

| Score | Coastline |
| ---: | --- |
| 0–14 | Small cay |
| 15–34 | Main island with a satellite islet |
| 35–57 | Long island chain |
| 58–77 | Separated archipelago |
| 78–100 | Lagoon surrounded by islands |

The login-derived seed fixes the coastline orientation, island shapes, vegetation, and building placement. Mountains unlock as island level rises; at level 5, the main landmass receives a central manor.

Port upgrades are independent, each with three levels:

| Building | GitHub signal | Levels |
| --- | --- | --- |
| Campfire | Confirmed authored commits | 0 / 100 / 1,000 |
| Settlement | Public repositories | 3 / 15 / 60 |
| Harbor | Public repositories | 1 / 10 / 40 |
| Fort | Stars in the sample | 10 / 100 / 1,000 |
| Treasure market | Forks in the sample | 1 / 20 / 200 |

The eight featured repositories also receive individual, clickable buildings:

- A fort for repositories with at least 10 stars.
- A treasure market for repositories with at least 2 forks.
- A campfire for repositories with at least 50 confirmed commits.
- A settlement for all remaining featured repositories.

Click a repository building to open its details and its GitHub URL. Click a shared port upgrade to see its source metric and the next unlock threshold.

## Controls

| Input | Action |
| --- | --- |
| `W` / `S` | Accelerate / reverse |
| `A` / `D` | Steer |
| Right mouse drag | Orbit camera around the player's ship |
| Mouse wheel | Zoom |
| `M` | Open or close the full nautical map |
| `E` near your moored ship | Disembark or board |
| Search | Travel to a developer's port |
| Go to my port | Return to the signed-in captain and re-enable sailing |

The full map can mark a free waypoint or a port. A compass and distance indicator guide manual sailing; it never steers the ship automatically.

### Walkable-port foundation

Ships are scaled below the size of a walkable building, while crew members share the fixed world scale of the playable captain and port residents. When the captain is signed in, slow down beside the moored ship at the home port and press `E` to disembark. Movement on land is limited to the solid landmasses of the archipelago; approach the ship and press `E` to board again.

This establishes a compatible scale and control loop for future interiors, public manor galleries, and persistent trophy displays.

## Local weather and light

Lighting follows the visitor's local browser clock: night, dawn, day, and dusk each change the sky, fog, and directional light. Weather is chosen from a deterministic random roll every 45 minutes using the local date, time window, and timezone. This means it feels variable without a weather API, server state, or frame-by-frame randomness.

Clear skies are most common, followed by clouds and haze; rain is occasional and storms are rare. Rain uses a single camera-local particle buffer, and it is not rendered at all when the current weather is dry.

## Exploration and discovery

Ports that have not yet been visited appear as fog banks in the 3D world and as anonymous markers on the minimap. Entering a port's waters reveals it and increases the discovery counter in the top bar. Discovery is saved in a versioned browser preference under `github-ocean:preferences:v1`; it contains only public GitHub logins and no tokens.

The local preference deliberately mirrors a future cloud shape: a `port_discoveries` table can store `user_id`, `github_login`, and `discovered_at`. This makes a later Supabase migration additive rather than a gameplay rewrite.

## Local development

### Requirements

- Node.js 20 or newer.
- Docker Desktop, for the local PostgreSQL database.
- A GitHub OAuth App if you want to test login.
- A GitHub token is recommended for higher API limits.

### Setup

```bash
npm install
copy .env.example .env
npm run db:up
npm run db:deploy
npm run dev
```

Open the Vite URL shown in the terminal.

Run the progression tests independently with:

```bash
npm run test:progression
```

## Environment variables

Copy `.env.example` to `.env` and set values locally. Never commit `.env`, OAuth secrets, database URLs, or production tokens.

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection string |
| `PORT` | Local API port |
| `WEB_ORIGIN` | Frontend origin allowed by the API |
| `API_ORIGIN` | Public API origin used by the OAuth callback |
| `GITHUB_TOKEN` | Optional GitHub API token for higher rate limits |
| `GITHUB_CLIENT_ID` | GitHub OAuth App client ID |
| `GITHUB_CLIENT_SECRET` | GitHub OAuth App secret |
| `SESSION_SECRET` | Secret used to sign login sessions in production |
| `CRON_SECRET` | Secret used by the protected world-indexing cron route |
| `ANALYTICS_SECRET` | Secret used to read the private analytics summary |
| `VITE_API_ORIGIN` | Optional separate API origin; leave empty for same-domain deployments |

For local OAuth, register:

```text
http://localhost:3001/api/auth/callback
```

as the Authorization callback URL in the GitHub OAuth App.

## Database and world indexing

The server stores developers, repositories, ports, analytics events, and indexer state in PostgreSQL. A developer's port coordinate is allocated once and remains stable after later profile updates.

The optional continuous local indexer can be run with:

```bash
npm run world:index
```

The Vercel-ready alternative is a protected daily Cron endpoint at `/api/cron/index-world`. It indexes a small batch per run and keeps its cursor in the database.

## Analytics

The project tracks:

- Application opens.
- Developer searches and successful profile loads.
- GitHub login starts and completions.
- Repository building opens.

Client events use a random anonymous browser identifier. GitHub OAuth tokens are never sent to the client and are not stored in analytics events.

The protected 30-day summary is available from the API:

```bash
curl -H "Authorization: Bearer YOUR_ANALYTICS_SECRET" \
  http://localhost:3001/api/analytics/summary
```

## Deployment

The repository includes `vercel.json` with the frontend build, API rewrite, and daily indexing Cron schedule.

Before deploying:

1. Create a managed PostgreSQL database.
2. Run `npm run db:deploy` against it.
3. Configure the production environment variables in the hosting dashboard.
4. Register `https://YOUR_DOMAIN/api/auth/callback` in the GitHub OAuth App.
5. Enable Vercel Web Analytics in the project dashboard if desired.

Do not paste secrets into issues, pull requests, screenshots, or this README.

## Project structure

```text
src/                   React application and 3D scene
server/                Express API, GitHub sync, workers, security
shared/progression.ts  Shared deterministic progression rules
prisma/                Database schema and migrations
api/                   Serverless API entry point
```

## License

Private project. Add a license before distributing the source code publicly.
