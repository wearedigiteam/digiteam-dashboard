# Digiteam Ops Dashboard

A live project dashboard combining GitHub Issues and Userback tasks
into a single view. Built with Next.js, deployed on Vercel.

---

## Setup (one-time, ~20 minutes)

### Step 1 — Create the repo

1. Create a new **private** repo in the `wearedigiteam` org — call it `digiteam-dashboard`
2. Push all these files to it
3. Do NOT commit `.env.local` — it's in `.gitignore`

---

### Step 2 — Deploy to Vercel

1. Go to vercel.com → New Project
2. Import `wearedigiteam/digiteam-dashboard`
3. Framework preset: **Next.js** (auto-detected)
4. Click **Deploy** — the first deploy will fail because env vars aren't set yet. That's fine.

---

### Step 3 — Add environment variables in Vercel

Go to your Vercel project → Settings → Environment Variables.
Add these four variables:

| Name | Value |
|------|-------|
| `DASHBOARD_PASSWORD` | Your chosen password for the dashboard |
| `SESSION_SECRET` | A random 32+ character string (run `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` to generate one) |
| `GITHUB_PAT` | Your classic GitHub PAT with `repo` scope |
| `USERBACK_API_KEY` | Your Userback API key |

After adding them, go to **Deployments** and click **Redeploy** on the latest deployment.

---

### Step 4 — Configure your projects

Open `config/projects.js` and fill in the `userbackId` for each project.

**To find your Userback project IDs:**
1. Log into the dashboard at your Vercel URL
2. Visit `https://your-app.vercel.app/api/userback-projects`
3. This returns a JSON list of all your Userback projects with their IDs
4. Copy the IDs into `config/projects.js`
5. Commit and push — Vercel will auto-redeploy

---

## Local development

```bash
npm install
cp .env.local.example .env.local
# Edit .env.local with your actual values
npm run dev
# Open http://localhost:3000
```

---

## Adding / removing projects

Edit `config/projects.js`:

```js
{
  name: 'Client Name',       // Display name on the dashboard
  githubRepo: 'repo-name',   // Exact repo name in wearedigiteam org (or null)
  userbackId: '12345',       // Userback project ID (or null)
}
```

Commit and push — Vercel deploys automatically.

---

## Refreshing data

The dashboard fetches live data every time you load it or click Refresh.
There's no caching — you always see current state.
