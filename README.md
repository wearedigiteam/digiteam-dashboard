# Digiteam Userback Dashboard

Automatically loads all non-archived Userback projects and team members.

## Environment variables

- `USERBACK_API_KEY` — Userback REST API key
- `DASHBOARD_PASSWORD` — login password
- `JWT_SECRET` — secret for session tokens
- `ANTHROPIC_API_KEY` — AI assistant and issue solver

### Monday Slack summary

- `SLACK_BOT_TOKEN` — bot token (`xoxb-...`) for the Digiteam Slack app
- `CRON_SECRET` — any long random string; Vercel Cron sends it automatically
- `SLACK_SEND_HOUR` — optional, Toronto local hour to send (default `8`)
- `DASHBOARD_URL` — optional, defaults to https://digiteam-dashboard.vercel.app

Slack app scopes: `chat:write`, `im:write`, `users:read`, `users:read.email`.

Who gets the DM, and their Slack member IDs, are set on the Admin tab.
