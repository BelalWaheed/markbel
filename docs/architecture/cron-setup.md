# Automated Notification Triggering

Markbel relies on a background task to scan the database for due bookmarks and dispatch remote push notifications to all your connected devices. Because this needs to happen even when you are not actively using the app, we expose a secure webhook.

## The Webhook

**Endpoint**: `POST /api/notifications/dispatch?secret=YOUR_CRON_SECRET`

When this endpoint is hit, the backend checks for bookmarks where `remindAt <= NOW()`. It then batches Expo Push notifications to mobile devices and Web Push notifications to web clients.

## Setting up a Free Cron Job

Vercel provides a Cron feature, but the Hobby (Free) tier only supports executing a cron job **once per day**. For reminders, you typically want a resolution of 10 to 15 minutes.

Here are two 100% free ways to automate this.

### Option 1: cron-job.org (Recommended)

1. Go to [cron-job.org](https://cron-job.org/) and create a free account.
2. Click **Create Cronjob**.
3. Set the Title to **Markbel Notifications**.
4. Set the URL to `https://<your-vercel-deployment-url>/api/notifications/dispatch?secret=<your-cron-secret>`.
5. Check **Execute every 15 minutes** in the schedule.
6. Under Advanced -> HTTP Method, select **POST**.
7. Save. It will now automatically ping your Vercel app every 15 minutes.

### Option 2: GitHub Actions

If your repository is hosted on GitHub, you can use a scheduled workflow to `curl` the endpoint. GitHub provides 2,000 free action minutes a month.

Create `.github/workflows/cron.yml` in your repository:

```yaml
name: Notification Dispatch Cron

on:
  schedule:
    - cron: '*/15 * * * *'

jobs:
  dispatch:
    runs-on: ubuntu-latest
    steps:
      - name: Ping Backend
        run: |
          curl -X POST "https://your-vercel-app.vercel.app/api/notifications/dispatch?secret=${{ secrets.CRON_SECRET }}"
```

Add your `CRON_SECRET` to your GitHub Repository Secrets.

## Securing the Endpoint
Always make sure you have the `CRON_SECRET` environment variable defined in your Vercel Dashboard. The backend uses this secret to ensure random bots cannot maliciously trigger the dispatch loop.
