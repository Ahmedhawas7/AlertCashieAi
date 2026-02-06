# Free Deployment: Cloudflare Workers (Hawas Agent)

This guide explains how to deploy the "Hawas" realtime agent to Cloudflare Workers for free (0$).

## Prerequisites
1. **Cloudflare Account** (Free).
2. **Supabase Database** (Free) - Ensure you have the `DATABASE_URL` and `SUPABASE_KEY` (Service Role or Anon, strictly prefer Service Role for write access if RLS is tight, but usually Anon is fine if policies allow). # actually for backend logic Service Role is safer to bypass RLS complexity in free tier setups unless configured.
3. **Telegram Bot Token**.

## Steps

### 1. Install Wrangler
If you haven't installed Cloudflare's CLI:
```bash
npm install -g wrangler
```
Login:
```bash
wrangler login
```

### 2. Configure Secrets
Run the following commands in your project terminal to securely store your keys:

```bash
wrangler secret put BOT_TOKEN
# Paste your Telegram Bot Token

wrangler secret put SUPABASE_URL
# Paste your Supabase Project URL (e.g. https://xyz.supabase.co)

wrangler secret put SUPABASE_KEY
# Paste your Supabase SERVICE_ROLE KEY (bypasses RLS, simplest for bot backend)

wrangler secret put TELEGRAM_ADMIN_IDS
# Paste comma-separated IDs: 123456,789012
```

### 3. Deploy
Deploy the worker:
```bash
npx wrangler deploy
```
You will get a URL like `https://hawas-worker.yourname.workers.dev`.

### 4. Set Webhook
You need to tell Telegram to send messages to your new worker.
Visit this URL in your browser (replace values):

`https://hawas-worker.yourname.workers.dev/setup?token=YOUR_BOT_TOKEN`

Or manually:
`https://api.telegram.org/bot<YOUR_TOKEN>/setWebhook?url=https://hawas-worker.yourname.workers.dev/telegram`

### 5. Verify
- Send `/start` to your bot.
- It should reply with the Hawas welcome message.
- Add it to a group and say "Hawas".

## Troubleshooting
- **Logs**: Run `npx wrangler tail` to see real-time logs.
- **Database**: Ensure your `Knowledge` table exists in Supabase (run `npx prisma db push` locally if needed).

## 100% Free Limits
- Cloudflare Workers: 100,000 requests/day (Plenty for a group bot).
- Supabase: 500MB database (Plenty for text knowledge).
