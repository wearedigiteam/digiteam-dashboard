# Digiteam Userback Dashboard

A focused Userback operations dashboard for Digiteam.

## Setup

1. Clone and `npm install`
2. Set environment variables:
   - `USERBACK_API_KEY` — your Userback REST API key
   - `GITHUB_PAT` — GitHub PAT (used only for persisting config files to this repo)
   - `DASHBOARD_PASSWORD` — login password
   - `JWT_SECRET` — secret for session tokens
3. `npm run dev`

## Architecture

- **Userback API** — all project data (tickets, members, projects)
- **GitHub API** — config storage only (projects.json, users.json)
- **No database** — config lives in this repo as JSON files

## Config files

- `projects.json` — which Userback projects to track (managed via Admin > Projects)
- `users.json` — team member display names mapped to Userback user IDs (managed via Admin > Team members)
