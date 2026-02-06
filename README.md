# 🌌 Cashie Watcher & GameFi Dashboard

A production-grade, FREE-to-run Telegram bot and futuristic Web3 dashboard for the CARV ecosystem on Base.

## 🚀 Features

### 🤖 Telegram Bot (Cashie Watcher)
- **On-Chain Signals**: Monitors Base Mainnet for CARV token transfers and contract interactions.
- **Announcement Alerts**: Polls Medium RSS for new community posts.
## 🧠 memU-style Proactive Memory

AlertCashie uses a local, rule-based memory system inspired by "memory as a file system."

- **Local Storage**: All knowledge is stored in `./memory/` as Markdown.
- **Proactive Insights**: The bot analyzes event patterns and creates suggestions (e.g., campaign detection).
- **Daily Digest**: At **09:00 Cairo time**, the bot posts a curated summary of the last 24h to the channel.
- **Personalized Focus**: Admins can set focus to `creator`, `dev`, or `both` to tailor action hints.

## 🚀 Free 24/7 Deployment

Optimized for **Render Free Tier + UptimeRobot**.

1.  **Host on Render**: Use the provided `FREE_DEPLOY.md` instructions.
2.  **UptimeRobot**: Ping the `/health` endpoint every 5 minutes to prevent sleeping.
3.  **Self-Healing**: Built-in circuit breakers and watchdog timers ensure stable operation.
4.  **Automated Backups**: Daily SQLite snapshots sent directly to your Telegram.

## 🧠 Intelligence & AI Mode

AlertCashie is built with an **offline-first** philosophy. It uses local Markdown files and SQLite to provide intelligence without requiring paid APIs.

### Offline Mode (Default)
- **Memory Retrieval**: The `/ask` command searches your local `memory/*.md` files and recent events.
- **Smart Hints**: Proactive suggestions based on pattern matching in your logs.
- **Contract Labels**: Manage contract names locally using `/label <address> <name>`.

### Optional Gemini AI
If you have a Gemini API key, you can enable advanced reasoning:
1. Add `GEMINI_API_KEY` to your `.env` file.
2. Use `/ai on` (Admin only) to enable the brain.
3. **Rate Limits**: By default, AI usage is limited to **10 calls per day** to stay within free tiers.
4. **Fallback**: If the AI is off, limited, or fails, the bot automatically switches back to offline mode.

## 🛠 Admin Commands
- `/status`: Check bot health and config.
- `/ai on|off`: Toggle Gemini AI brain.
- `/label <address> <name>`: Identify a contract address.
- `/labels`: List all known labels.
- `/remember <note>`: Add a permanent note to memory.
- `/forget <keyword>`: Mark matching memories as deprecated.
- `/backupnow`: Trigger an immediate cloud/Telegram backup.
- `/digestnow`: Force a daily summary generation.
- **Admin Tools**: Protected commands for contract monitoring management.
- **Smart Q&A**: Knowledge-base-driven answers via `/ask`.
- **Identity Hub**: Connect CARV IDs via `/connect`.

### 🎮 GameFi Dashboard (Visual Rebirth)
- **Futuristic HUD**: Ultra-clean, sci-fi-inspired dark mode.
- **Modular Layout**: Real-time status cards for XP, Gems, and Network health.
- **Gamification**: Visual progression indicators and reward animations.
- **Live Stream**: Interactive log of recent ecosystem events.

---

## 🛠️ Setup Instructions

### 1. Project Initialization
```bash
git clone <your-repo>
cd cosmic-planetary
npm install
cd dashboard && npm install && cd ..
```

### 2. Environment Configuration
Copy `.env.example` to `.env` and fill in your details:
- `BOT_TOKEN`: Get from @BotFather.
- `TELEGRAM_ADMIN_IDS`: Your Telegram ID.
- `BASE_RPC_URL`: Use `https://mainnet.base.org` (Free).

### 3. Database Setup
```bash
npx prisma db push
npx prisma generate
```

### 4. Running the Project
- **Bot**: `npm run dev` (starts the Telegram watcher & services)
- **Dashboard**: `cd dashboard && npm run dev` (starts the Vite dev server)

---

## 🚢 Deployment Options (FREE)

### Option A: Railway / Render (Easiest)
1. Push this repo to GitHub.
2. Connect to Railway/Render.
3. Add environment variables.
4. Deployment command: `npm start`.

### Option B: VPS / Self-Hosted
Use the included `Dockerfile`:
```bash
docker build -t cashie-watcher .
docker run -d --env-file .env cashie-watcher
```

---

## 🛡️ Security
- **Strict User Inputs**: All commands are validated and sanitized.
- **Admin Isolation**: Sensitive commands are locked to `TELEGRAM_ADMIN_IDS`.
- **No Paid APIs**: Operates entirely on public JSON-RPC and RSS.

## 📄 License
MIT
