# Deployment Script for CARV ID Integration

This script automates the deployment process for the Hawas Worker with CARV ID integration.

## Prerequisites

Before running this script, ensure you have:
1. Cloudflare account with Workers enabled
2. CARV Developer account with OAuth app created
3. Telegram bot token from @BotFather
4. Your Telegram user ID (get from @userinfobot)

## Steps

### 1. Install Dependencies

```bash
npm install --save-dev wrangler
```

### 2. Create D1 Database

```bash
npx wrangler d1 create hawas-db
```

Copy the database ID from the output and update `wrangler.toml`:
```toml
database_id = "YOUR_DATABASE_ID_HERE"
```

### 3. Update Configuration

Edit `wrangler.toml` and set:
- `OWNER_TELEGRAM_ID` - Your Telegram user ID
- `CARV_REDIRECT_URL` - Will be updated after first deployment

### 4. Set Secrets

```bash
# Required secrets
npx wrangler secret put BOT_TOKEN
npx wrangler secret put CARV_CLIENT_ID
npx wrangler secret put CARV_CLIENT_SECRET
npx wrangler secret put ENCRYPTION_SECRET
npx wrangler secret put SUPABASE_URL
npx wrangler secret put SUPABASE_KEY

# Optional
npx wrangler secret put GEMINI_API_KEY
```

Generate encryption secret:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 5. Apply D1 Migrations

```bash
npx wrangler d1 migrations apply hawas-db --remote
```

### 6. Deploy Worker

```bash
npx wrangler deploy
```

Copy the deployed URL from the output.

### 7. Update CARV Redirect URL

1. Update `wrangler.toml`:
   ```toml
   CARV_REDIRECT_URL = "https://hawas-worker.YOUR-SUBDOMAIN.workers.dev/auth/carv/callback"
   ```

2. Update CARV Developer Portal with the same URL

3. Redeploy:
   ```bash
   npx wrangler deploy
   ```

### 8. Set Telegram Webhook

```bash
curl -X POST "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://hawas-worker.YOUR-SUBDOMAIN.workers.dev/telegram"}'
```

### 9. Verify Deployment

Test the following:
- Health check: `https://hawas-worker.YOUR-SUBDOMAIN.workers.dev/health`
- Telegram bot: Send `/start` to your bot
- CARV linking: Send `/connect` to your bot

## Troubleshooting

### Database not found
Run: `npx wrangler d1 list`

### Migrations not applied
Run: `npx wrangler d1 migrations list hawas-db --remote`

### Webhook not working
Check: `curl "https://api.telegram.org/bot<TOKEN>/getWebhookInfo"`

### View logs
Run: `npx wrangler tail`

## Available Commands

After deployment, the bot supports:
- `/start` - Welcome message
- `/connect` - Link CARV ID (owner only)
- `/whoami` - Show connection info
- `/status` - Agent status (owner only)
- `/digestnow` - Generate digest (owner only)
- `/plan` - Show agent capabilities (owner only)

## Automated Daily Digest

The cron trigger runs daily at 09:00 (Africa/Cairo timezone) and sends a digest to the owner automatically.
