# CARV ID Integration - Deployment Guide

## Prerequisites

1. **Cloudflare Account** with Workers enabled
2. **CARV Developer Account** - Register at [CARV Developer Portal](https://protocol.carv.io/developers)
3. **Telegram Bot** - Already created via @BotFather
4. **Wrangler CLI** installed: `npm install -g wrangler`

---

## Step 1: Create D1 Database

```bash
# Navigate to project directory
cd c:\Users\Dell\.gemini\antigravity\playground\cosmic-planetary

# Create D1 database
wrangler d1 create hawas-db
```

**Output:**
```
✅ Successfully created DB 'hawas-db'
Database ID: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
```

**Copy the Database ID** and update `wrangler.toml`:
```toml
[[d1_databases]]
binding = "DB"
database_name = "hawas-db"
database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"  # Paste here
```

---

## Step 2: Apply D1 Migrations

```bash
# Apply the migration
wrangler d1 migrations apply hawas-db --remote

# Verify tables were created
wrangler d1 execute hawas-db --remote --command "SELECT name FROM sqlite_master WHERE type='table';"
```

**Expected output:**
- `pending_connect_sessions`
- `connections`
- `auth_logs`

---

## Step 3: Register OAuth Application with CARV

### Option A: Telegram Mini App (Recommended for Telegram Bots)

1. Go to [CARV Developer Portal](https://protocol.carv.io/developers)
2. Create new application:
   - **Name**: Hawas Bot
   - **Redirect URL**: `https://t.me/YOUR_BOT_USERNAME/carv_auth`
     - Replace `YOUR_BOT_USERNAME` with your bot's username
     - `carv_auth` is your mini app short name (create via @BotFather)
   - **Scopes**: `carv_id_basic_read email_basic_read evm_address_basic_read`
3. **Save** `Client ID` and `Client Secret`

**Note**: You'll need to create a Telegram Mini App via @BotFather:
```
/newapp
Select your bot
App name: CARV Auth
Short name: carv_auth
```

### Option B: Web Redirect (Alternative)

If CARV supports web redirects for your use case:
- **Redirect URL**: `https://your-worker.workers.dev/auth/carv/callback`
- Ensure exact match in CARV Portal

---

## Step 4: Configure Secrets

```bash
# Telegram Bot Token
wrangler secret put BOT_TOKEN
# Paste your bot token when prompted

# CARV Client ID
wrangler secret put CARV_CLIENT_ID
# Paste CARV client ID

# CARV Client Secret
wrangler secret put CARV_CLIENT_SECRET
# Paste CARV client secret

# Encryption Secret (generate first)
# Generate: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
wrangler secret put ENCRYPTION_SECRET
# Paste generated hex string

# Existing secrets (if not already set)
wrangler secret put SUPABASE_URL
wrangler secret put SUPABASE_KEY
wrangler secret put GEMINI_API_KEY
```

---

## Step 5: Update wrangler.toml Variables

Edit `wrangler.toml`:

```toml
[vars]
OWNER_TELEGRAM_ID = "123456789"  # Your Telegram user ID
CARV_REDIRECT_URL = "https://t.me/YOUR_BOT_USERNAME/carv_auth"  # Or web callback URL
```

**How to get your Telegram User ID:**
1. Message [@userinfobot](https://t.me/userinfobot)
2. Copy the `Id` number

---

## Step 6: Deploy Worker

```bash
# Deploy to Cloudflare
wrangler deploy

# Output:
# ✨ Built successfully
# ✨ Uploaded hawas-worker
# ✨ Deployed hawas-worker
# https://hawas-worker.your-subdomain.workers.dev
```

**If using web redirect**: Copy the deployed URL and update:
1. `wrangler.toml` → `CARV_REDIRECT_URL = "https://hawas-worker.your-subdomain.workers.dev/auth/carv/callback"`
2. CARV Developer Portal → Redirect URL

Then **redeploy**:
```bash
wrangler deploy
```

---

## Step 7: Set Telegram Webhook (SECURE METHOD)

### Option A: Using Wrangler (Recommended)

```bash
# Get your worker URL
wrangler deployments list

# Set webhook via Telegram API (replace with your values)
curl -X POST "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://hawas-worker.your-subdomain.workers.dev/telegram"}'
```

### Option B: Using Telegram BotFather

1. Message @BotFather
2. `/setdomain`
3. Select your bot
4. Enter: `https://hawas-worker.your-subdomain.workers.dev/telegram`

**Expected response:**
```json
{"ok":true,"result":true,"description":"Webhook was set"}
```

**⚠️ SECURITY NOTE**: Never expose `BOT_TOKEN` in URL query strings or logs.

---

## Step 8: Test OAuth Flow

### Test /connect Command

1. Open Telegram and message your bot: `/connect`
2. Bot should reply with CARV authorization link
3. Click the link → Authorize in Telegram/Web
4. Should redirect to callback → Success message
5. Bot sends confirmation in Telegram

### Test /whoami Command

```
/whoami
```

**Expected response:**
```
✅ معلومات الربط

👤 Telegram ID: 123456789
🆔 CARV ID: 0xabc123...
💼 Wallet: 0xdef456...
📧 Email: user@example.com
🕐 Linked: 2026-02-07 17:30:00
```

### Test Admin Command Gating

```
/admin
```

**If not linked:**
```
⛔ يجب أن تكون المالك ومربوط بـ CARV ID لاستخدام هذا الأمر.

استخدم /connect أولاً.
```

**If linked:**
```
✅ Admin command executed (linked owner).
```

---

## Troubleshooting

### Error: "Invalid or expired state"
- State expires after 10 minutes
- Generate new link with `/connect`
- Check D1 database for expired sessions:
  ```bash
  wrangler d1 execute hawas-db --remote --command "SELECT * FROM pending_connect_sessions WHERE expires_at < $(date +%s)000;"
  ```

### Error: "Token exchange failed"
- Verify `CARV_CLIENT_ID` and `CARV_CLIENT_SECRET` are correct
- Check redirect URL matches exactly in CARV Portal
- Ensure `CARV_REDIRECT_URL` in wrangler.toml matches registered URL

### Error: "Missing code or state"
- Verify CARV Developer Portal redirect URL
- Must match `CARV_REDIRECT_URL` exactly
- For Telegram Mini Apps, ensure app is created via @BotFather

### Database errors
- Run: `wrangler d1 migrations list hawas-db --remote`
- Ensure migration was applied
- Check table structure:
  ```bash
  wrangler d1 execute hawas-db --remote --command "PRAGMA table_info(connections);"
  ```

### Webhook not receiving updates
- Verify webhook is set: 
  ```bash
  curl "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getWebhookInfo"
  ```
- Check Worker logs: `wrangler tail`
- Ensure Worker URL is publicly accessible

---

## Security Checklist

- ✅ Tokens encrypted with AES-256-GCM (Web Crypto API)
- ✅ State nonce with 10-minute TTL
- ✅ Owner-only commands require CARV link
- ✅ No seed phrases or transaction signing
- ✅ Audit logs for all auth events
- ✅ No BOT_TOKEN in URLs or query strings
- ✅ HTTPS-only communication
- ✅ Expired sessions auto-cleanup

---

## Monitoring

### View D1 Data

```bash
# Check connections
wrangler d1 execute hawas-db --remote --command "SELECT * FROM connections;"

# Check auth logs
wrangler d1 execute hawas-db --remote --command "SELECT * FROM auth_logs ORDER BY timestamp DESC LIMIT 10;"

# Check pending sessions
wrangler d1 execute hawas-db --remote --command "SELECT * FROM pending_connect_sessions;"

# Manual cleanup of expired sessions
wrangler d1 execute hawas-db --remote --command "DELETE FROM pending_connect_sessions WHERE expires_at < $(date +%s)000;"
```

### Worker Logs

```bash
# Real-time logs
wrangler tail

# Filter for errors
wrangler tail --format pretty | grep -i error
```

---

## Local Development

```bash
# Install dependencies
npm install

# Run local dev server with D1 local database
wrangler dev --local

# For OAuth callback testing, use ngrok
ngrok http 8787
# Temporarily update CARV_REDIRECT_URL to ngrok URL in CARV Portal
```

**Note**: Local D1 database is separate from remote. Apply migrations locally:
```bash
wrangler d1 migrations apply hawas-db --local
```

---

## Next Steps

1. **Add `/disconnect` command** to unlink CARV ID
2. **Implement token refresh** using `refresh_token`
3. **Add more admin commands** with `requireLinkedOwner()`
4. **Enhanced logging** for security events
5. **Rate limiting** on OAuth endpoints
6. **Backup D1 data** periodically

---

## Architecture Notes

### Redirect URI Flow

**Telegram Mini App (Recommended):**
```
User → /connect → CARV Auth → Telegram Mini App → Extract code/state → Worker callback
```

**Web Redirect (Alternative):**
```
User → /connect → CARV Auth → Worker /auth/carv/callback → Telegram notification
```

### State Management

- Generated: 64-char cryptographically secure random hex
- Stored: D1 `pending_connect_sessions` table
- TTL: 10 minutes
- Cleanup: Automatic on health check + manual validation

### Token Storage

- Encryption: AES-256-GCM via Web Crypto API
- Key derivation: PBKDF2 (100,000 iterations)
- Storage: D1 `connections` table (encrypted)
- Optional: Can skip token storage if not needed for API calls

---

**🎉 CARV ID Integration Complete!**

Your bot now has secure, owner-only CARV ID linking with production-grade security.


## Prerequisites

1. **Cloudflare Account** with Workers enabled
2. **CARV Developer Account** - Register at [CARV Developer Portal](https://protocol.carv.io/developers)
3. **Telegram Bot** - Already created via @BotFather
4. **Wrangler CLI** installed: `npm install -g wrangler`

---

## Step 1: Create D1 Database

```bash
# Navigate to project directory
cd c:\Users\Dell\.gemini\antigravity\playground\cosmic-planetary

# Create D1 database
wrangler d1 create hawas-db
```

**Output:**
```
✅ Successfully created DB 'hawas-db'
Database ID: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
```

**Copy the Database ID** and update `wrangler.toml`:
```toml
[[d1_databases]]
binding = "DB"
database_name = "hawas-db"
database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"  # Paste here
```

---

## Step 2: Apply D1 Migrations

```bash
# Apply the migration
wrangler d1 migrations apply hawas-db --remote

# Verify tables were created
wrangler d1 execute hawas-db --remote --command "SELECT name FROM sqlite_master WHERE type='table';"
```

**Expected output:**
- `pending_connect_sessions`
- `connections`
- `auth_logs`

---

## Step 3: Register OAuth Application with CARV

1. Go to [CARV Developer Portal](https://protocol.carv.io/developers)
2. Create new application:
   - **Name**: Hawas Bot
   - **Redirect URL**: `https://your-worker.workers.dev/auth/carv/callback`
   - **Scopes**: `carv_id_basic_read email_basic_read evm_address_basic_read`
3. **Save** `Client ID` and `Client Secret`

---

## Step 4: Configure Secrets

```bash
# Telegram Bot Token
wrangler secret put BOT_TOKEN
# Paste your bot token when prompted

# CARV Client ID
wrangler secret put CARV_CLIENT_ID
# Paste CARV client ID

# CARV Client Secret
wrangler secret put CARV_CLIENT_SECRET
# Paste CARV client secret

# Encryption Secret (generate first)
# Generate: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
wrangler secret put ENCRYPTION_SECRET
# Paste generated hex string

# Existing secrets (if not already set)
wrangler secret put SUPABASE_URL
wrangler secret put SUPABASE_KEY
wrangler secret put GEMINI_API_KEY
```

---

## Step 5: Update wrangler.toml Variables

Edit `wrangler.toml`:

```toml
[vars]
OWNER_TELEGRAM_ID = "123456789"  # Your Telegram user ID
CARV_REDIRECT_URL = "https://hawas-worker.your-subdomain.workers.dev/auth/carv/callback"
```

**How to get your Telegram User ID:**
1. Message [@userinfobot](https://t.me/userinfobot)
2. Copy the `Id` number

---

## Step 6: Deploy Worker

```bash
# Deploy to Cloudflare
wrangler deploy

# Output:
# ✨ Built successfully
# ✨ Uploaded hawas-worker
# ✨ Deployed hawas-worker
# https://hawas-worker.your-subdomain.workers.dev
```

**Copy the deployed URL** and update:
1. `wrangler.toml` → `CARV_REDIRECT_URL`
2. CARV Developer Portal → Redirect URL

Then **redeploy**:
```bash
wrangler deploy
```

---

## Step 7: Set Telegram Webhook

```bash
# Visit setup endpoint (replace with your worker URL)
curl "https://hawas-worker.your-subdomain.workers.dev/setup?token=YOUR_BOT_TOKEN"
```

**Expected response:**
```json
{"ok":true,"result":true,"description":"Webhook was set"}
```

---

## Step 8: Test OAuth Flow

### Test /connect Command

1. Open Telegram and message your bot: `/connect`
2. Bot should reply with CARV authorization link
3. Click the link → Authorize in Telegram
4. Should redirect to callback → Success message
5. Bot sends confirmation in Telegram

### Test /whoami Command

```
/whoami
```

**Expected response:**
```
✅ معلومات الربط

👤 Telegram ID: 123456789
🆔 CARV ID: 0xabc123...
💼 Wallet: 0xdef456...
📧 Email: user@example.com
🕐 Linked: 2026-02-07 17:30:00
```

### Test Admin Command Gating

```
/admin
```

**If not linked:**
```
⛔ يجب أن تكون المالك ومربوط بـ CARV ID لاستخدام هذا الأمر.

استخدم /connect أولاً.
```

**If linked:**
```
✅ Admin command executed (linked owner).
```

---

## Troubleshooting

### Error: "Invalid or expired state"
- State expires after 10 minutes
- Generate new link with `/connect`

### Error: "Token exchange failed"
- Check `CARV_CLIENT_ID` and `CARV_CLIENT_SECRET`
- Verify redirect URL matches exactly

### Error: "Missing code or state"
- Check CARV Developer Portal redirect URL
- Must match `CARV_REDIRECT_URL` in wrangler.toml

### Database errors
- Run: `wrangler d1 migrations list hawas-db --remote`
- Ensure migration was applied

---

## Local Development

```bash
# Install dependencies
npm install

# Run local dev server
wrangler dev

# Test with ngrok for OAuth callback
ngrok http 8787
# Update CARV_REDIRECT_URL to ngrok URL temporarily
```

---

## Security Checklist

- ✅ Tokens encrypted with AES-256-GCM
- ✅ State nonce with 10-minute expiration
- ✅ Owner-only commands require CARV link
- ✅ No seed phrases or signing
- ✅ Audit logs for all auth events

---

## Monitoring

### View D1 Data

```bash
# Check connections
wrangler d1 execute hawas-db --remote --command "SELECT * FROM connections;"

# Check auth logs
wrangler d1 execute hawas-db --remote --command "SELECT * FROM auth_logs ORDER BY timestamp DESC LIMIT 10;"

# Check pending sessions
wrangler d1 execute hawas-db --remote --command "SELECT * FROM pending_connect_sessions;"
```

### Worker Logs

```bash
wrangler tail
```

---

## Next Steps

1. **Add more admin commands** that require `requireLinkedOwner()`
2. **Implement token refresh** using `refresh_token`
3. **Add disconnect flow** (`/disconnect` command)
4. **Enhance audit logging** with more event types

---

**🎉 CARV ID Integration Complete!**
