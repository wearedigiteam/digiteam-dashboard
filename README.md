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

### Team scoreboard

- `USERBACK_WEBHOOK_SECRET` — long random string; goes on the end of the webhook URL
- `SCORE_DEFAULT_GOAL` — optional, the weekly goal until there are past weeks to average (default `25`)

Webhook URL for each Userback project (Settings → Integrations → Webhook, tick "Feedback status is changed"):
`https://digiteam-dashboard.vercel.app/api/webhooks/userback?key=YOUR_SECRET`

Scores are also checked against a stored snapshot on every dashboard load and once a day, so a missed webhook or a project without one is still counted. Each ticket scores once.
