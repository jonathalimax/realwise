# Rollback a Production Deploy

## Option A — Coolify UI (< 2 minutes)

1. Open Coolify → select the app (realwise-web, realwise-admin, or realwise-api)
2. Click **Deployments** tab
3. Find the last successful deploy — click **Redeploy**

Coolify re-runs that deployment with the same image tag it used previously.

## Option B — Re-trigger previous GitHub Actions run (< 5 minutes)

1. Open GitHub Actions → find the last successful workflow run before the bad one
2. Click **Re-run all jobs**
3. This pushes the previous commit's `sha-XXXXXXX` image and fires Coolify webhook

## Option C — Manual image override (fastest for API)

If you need a specific commit's image:

```bash
# SSH into VPS
ssh root@62.238.45.195

# Find the SHA tag you want from GHCR (check GitHub Packages UI)
# Tell Coolify to use it — or run directly:
docker pull ghcr.io/jonathalima/realwise-api:sha-abc1234
docker tag ghcr.io/jonathalima/realwise-api:sha-abc1234 ghcr.io/jonathalima/realwise-api:latest
```

Then trigger Coolify redeploy from UI.
