# Free 100% Credit-Card-Free Deployment (GitHub Actions) 🚀

This guide explains how to run AlertCashie **entirely for free** without Render, using **GitHub Actions** as a scheduled runner (Cron Job) and **Supabase** for persistent storage.

## How it Works
- **GitHub Actions** wakes up every 5 minutes.
- It connects to **Supabase** (DB) to remember what it last saw.
- It checks **Medium RSS** and **Base Mainnet** logs.
- It sends new alerts to Telegram.
- It goes back to sleep (0 cost).

---

## ⚡ 1. Setup Database (Supabase)
*If you already did this for the Render guide, skip to step 2.*

1. Go to [supabase.com](https://supabase.com) and create a free project.
2. Get your **Connection String** (URI mode).
3. Add `?sslmode=require` to the end.
   - Example: `postgresql://postgres:[PASSWORD]@...supabase.co:5432/postgres?sslmode=require`
4. **Important**: URL Encode your password if it has special characters (`@` -> `%40`).

---

## 🔐 2. Configure GitHub Secrets

1. Go to your GitHub Repository -> **Settings** -> **Secrets and variables** -> **Actions**.
2. Click **New repository secret**.
3. Add the following secrets (Exact Names):

| Name | Value |
|------|-------|
| `BOT_TOKEN` | Your Telegram Bot Token (`12345:ABC...`) |
| `DATABASE_URL` | Your Supabase URL (from Step 1) |
| `TELEGRAM_ADMIN_IDS` | Your Telegram ID (e.g. `12345678`) |
| `BASE_RPC_URL` | `https://mainnet.base.org` |
| `MEDIUM_RSS_URL` | `https://medium.com/feed/@carv_official` |
| `GEMINI_API_KEY` | (Optional) Your Gemini Key |

---

## 🚀 3. Enable the Workflow

1. Go to the **Actions** tab in your GitHub repo.
2. You should see "AlertCashie Runner" listed on the left.
3. It might warn you that workflows are disabled on forks. Click **"I understand my workflows, go ahead and enable them"**.
4. The bot will now run automatically **every 5 minutes**.

### Manual Run (Test)
You don't have to wait 5 minutes to test it:
1. Go to **Actions** -> **AlertCashie Runner**.
2. Click **Run workflow** (Blue button on the right).
3. Wait ~1 minute.
4. Check your Telegram; if there are new events, you will get a message.

---

## 🛑 Limitations vs Render
- **Not realtime**: It checks every 5 minutes, so alerts can be up to 5 minutes delayed.
- **No `/health` endpoint**: UptimeRobot is not needed (GitHub triggers it).
- **No Web Dashboard**: The `/dashboard` URL won't exist because there is no web server running.

---

## 🛠 Troubleshooting

- **"Error: P1001: Can't reach database"**:
  - Check your `DATABASE_URL` secret. Did you add `?sslmode=require`?
  - Did you URL encode the password?

- **"Process exited with code 1"**:
  - Click on the failed run in GitHub Actions to see the logs.
  - It handles errors gracefully, but bad config will crash it.
