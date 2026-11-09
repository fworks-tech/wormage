# Deploy on Vercel

The repository is a standard Vite SPA with one extra requirement: the MSW service worker (`public/mockServiceWorker.js`) must be served from the site root and must not be rewritten to `index.html`.

`vercel.json` already handles both the SPA rewrite and the worker headers, so the default path is three commands.

## 1. Prerequisites

- Node 20+ locally
- a GitHub account with the repo pushed (the project can also be deployed from a local folder)
- a Vercel account

## 2. Deploy from the CLI

```bash
npm i -g vercel
cd wormageddon
vercel login
vercel          # preview URL, answers a few project questions
vercel --prod   # production URL
```

Vercel auto-detects Vite. When asked, the answers are:

| Question | Answer |
| --- | --- |
| Set up and deploy? | Yes |
| Link to existing project? | No (first time) |
| Project name | `wormageddon` (or anything) |
| Directory | `./` |
| Override build settings? | No |

## 3. Deploy from the dashboard

1. **Add New → Project → Import Git Repository**, pick `fworks-tech/wormageddon` (the actual repo name).
2. Framework preset: **Vite**.
3. Build command: `npm run build`.
4. Output directory: `dist`.
5. Install command: `npm install`.
6. Node version: 20.x (Project → Settings → General).
7. Deploy.

Environment variables: **none required**. `VITE_LOCAL_API=true` is optional and forces the in-process mock adapter instead of the service worker (useful if a proxy strips service workers).

## 4. What `vercel.json` does

```json
{
  "framework": "vite",
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "rewrites": [{ "source": "/((?!mockServiceWorker\\.js).*)", "destination": "/index.html" }],
  "headers": [
    {
      "source": "/mockServiceWorker.js",
      "headers": [
        { "key": "Cache-Control", "value": "public, max-age=0, must-revalidate" },
        { "key": "Service-Worker-Allowed", "value": "/" }
      ]
    }
  ]
}
```

- The negative lookahead keeps `/mockServiceWorker.js` out of the SPA fallback. Without it the browser receives `index.html` for the worker request and MSW fails to start, so the ranking/history tabs would error.
- `Cache-Control: max-age=0` ensures browsers pick up a new worker after a deploy; `Service-Worker-Allowed: /` keeps its scope at the site root.
- Any other unknown path falls back to `index.html`, which is what a client-side-only app needs.

## 5. Verify a deployment

1. Open the root URL: the menu should render with the sunset hero.
2. Go to **Ranking**: rows should appear after a short delay (MSW + Axios + TanStack Query).
3. **Match history** should show the empty state until you finish a match.
4. Start a match, fire once, end the turn: the AI should answer.
5. Open DevTools → Application → Service Workers: `mockServiceWorker.js` should be **activated**.
6. Reload: the leaderboard should still render from the persisted mock database.

## 6. Single-file variant (no Vercel)

For a portfolio page or an iframe demo:

```bash
npm run build:single
# dist-single/index.html is fully self-contained
```

In this mode the app detects `MODE === 'single'` and uses the Axios in-process adapter instead of MSW. You can host the file on any static host, a Google Drive preview or a personal site.

## 7. Troubleshooting

| Symptom | Cause | Fix |
| --- | --- | --- |
| Ranking shows “uplink is down” | `/mockServiceWorker.js` was rewritten or blocked | Check the rewrite lookahead and the worker headers |
| 404 for `/mockServiceWorker.js` | `public/` file not committed | `npx msw init public --save`, commit it |
| Blank page after deploy | Wrong output directory | Set `dist`, not `build` or `dist-single` |
| Build fails on types | `tsc` runs before Vite | Fix the reported file; do not skip with `ignoreBuildErrors` |
| Worker stale after deploy | Browser cached the old SW | Hard reload; the `max-age=0` header prevents recurrence |
| Match not appearing in Ranking | Ruleset filter | The board is scoped to the active turn timer/wind/difficulty; switch rulesets in Options |

## 8. Custom domain

Project → Settings → Domains → add the domain, then point the DNS record Vercel shows. HTTPS is automatic. No code changes are required because all API paths are relative (`/api/...`).
