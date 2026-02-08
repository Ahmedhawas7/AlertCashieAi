# HX Agent - Super Telegram Agent 🚀

Always-on assistant with Brain (LLM), Memory (Supabase), Skills (Plugins), and Scheduler.

## 🌟 Features
- **Brain**: Powered by OpenAI/DeepSeek (via `src/brain`).
- **Memory**: Remembers chats and user facts (via Supabase).
- **Skills**: Plugin architecture (`src/skills`).
- **Safety**: Human-in-the-loop approval for sensitive actions.
- **Scheduler**: Cron jobs managed via Telegram.

## 🛠 Prerequisites
- Node.js v18+
- Supabase Project (Free Tier OK)
- Telegram Bot Token (from @BotFather)
- OpenAI or DeepSeek API Key

## 🚀 ZERO-TO-RUNNING Checklist

### 1. Setup Environment
1.  Navigate to `hx-agent`:
    \`\`\`bash
    cd hx-agent
    \`\`\`
2.  Install dependencies:
    \`\`\`bash
    npm install
    \`\`\`
3.  Configure `.env`:
    \`\`\`bash
    cp .env.example .env
    # Edit .env and fill in your keys
    \`\`\`

### 2. Setup Database
1.  Go to your Supabase Dashboard -> SQL Editor.
2.  Copy contents of `supabase_schema.sql`.
3.  Run the SQL to create tables.

### 3. Run the Bot
- **Development**:
  \`\`\`bash
  npm run dev
  \`\`\`
- **Production**:
  \`\`\`bash
  npm start
  \`\`\`

## 📚 Commands
| Command | Description |
| :--- | :--- |
| \`/start\` | Wake up the agent |
| \`/scan <url>\` | Scan a link for safety |
| \`/plan\` | Generate weekly plan |
| \`/draft <topic>\` | Draft content |
| \`/approve <token>\` | Approve a sensitive action |

## 📦 Deployment (Render / Railway)
1.  Push this folder to GitHub.
2.  **Render**:
    - New Web Service (or Background Worker).
    - Build Command: `npm install`
    - Start Command: `npm start`
    - Add Environment Variables from `.env`.
3.  **Railway**:
    - New Project -> Deploy from GitHub.
    - Add Variables.

## 🧩 Extending (How to add Skills)
Values simplicity. Just add a file to `src/skills/definitions/`.
See `EXTENDING.md` for details.
