# Digiteam Userback Dashboard

Automatically loads all non-archived Userback projects and team members.

## Environment variables

- `USERBACK_API_KEY` — Userback REST API key
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` — OAuth client from the Digiteam Dashboard Google Cloud project (Internal app)
- `NEXTAUTH_SECRET` — long random string that signs sign-in sessions
- `ALLOWED_EMAIL_DOMAIN` — optional, defaults to `digiteam.ca`
- `ADMIN_EMAILS` — optional, comma-separated emails allowed on the Admin tab (unset = everyone signed in)
- `DEFAULT_COMMENT_USER_ID` — optional, Userback userId for AI comments when the signer isn't a Userback member (default Chris's)
- `SLACK_ALERTS_CHANNEL` — Slack channel ID for Userback API outage alerts (invite the app to it)
- `ANTHROPIC_API_KEY` — AI assistant and issue solver

Sign-in is Google only, limited to verified @digiteam.ca Workspace accounts. Redirect URIs registered in Google:
`https://dashboard.digiteam.ca/api/auth/callback/google` and `https://digiteam-dashboard.vercel.app/api/auth/callback/google`

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

### Speed

The dashboard serves a cached copy of the Userback data (in KV) so it opens instantly, then refreshes in the background if the copy is over a minute old. Refresh always fetches fresh data, and the daily cron keeps the cache warm.

### Easter eggs

Seasonal and hidden extras live in `components/eggs.js` (dates, Bruno's canned replies) and `components/EggOverlays.js`. Team birthdays are entered on the Admin tab and stored in KV, never in this repo. Once-per-person eggs are tracked by `/api/eggs/claim`.
