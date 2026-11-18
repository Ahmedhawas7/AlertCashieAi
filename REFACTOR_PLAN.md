# REFACTOR PLAN: Hawas / AlertCashieBot

## 1. File Structure and Cleanup

We will strictly enforce the Cloudflare Worker approach at `src/worker/`.
The legacy containerized codebase will be removed or quarantined.

**Files to DELETE:**
- `src/index.ts`
- `src/server.ts`
- `src/bot/*`
- `src/services/*`
- `src/index.v2.ts`
- `src/worker/index.v2.ts` (Merge core ideas into `src/worker/index.ts`)
- `src/worker/core-v2/*` (Merge logic to main brain)

**Files to KEEP / MERGE:**
- `src/worker/index.ts`: Will remain the **Single Authoritative Entrypoint**.
- `src/worker/brain/`: Will be merged into a single cohesive Agent Brain. We will remove the legacy `agency.ts` vs `brain.ts` duplication.
- `src/worker/whale/`: We will remove fake mocks in `executor.ts`. It will correctly use viem or safely decline if disabled.
- `src/worker/carv/`: Keep the OAuth loop, ensure keys are stored safely.

## 2. Execution Tracking Engine (Phase 4)
We will create a real task tracking system so the Bot never fakes execution.

**D1 Table `agent_tasks`:**
```sql
CREATE TABLE agent_tasks (
    id TEXT PRIMARY KEY,
    owner_id TEXT NOT NULL,
    title TEXT,
    type TEXT,
    status TEXT, -- 'pending', 'in_progress', 'completed', 'failed'
    progress_current INTEGER DEFAULT 0,
    progress_total INTEGER DEFAULT 1,
    steps_json TEXT,
    result_json TEXT,
    error TEXT,
    created_at INTEGER,
    updated_at INTEGER
);
```
**Flow:**
1. AI Planner outputs a "Plan" JSON.
2. Bot saves Plan to `agent_tasks`.
3. Bot replies: "خطة التنفيذ: 1/3..."
4. For every step executed (e.g., calling CARV auth, swapping tokens), bot updates D1 and edits Telegram message or replies.

## 3. Provider Failover (Phase 6)
AI Provider routing will be abstracted into a single interface.
1. **Primary**: Groq (`llama-3.3-70b-versatile`)
2. **Secondary**: OpenRouter (if explicitly provided in ENV)
3. **Fallback**: Offline retrieval + deterministic responses.

If a provider hits 429 Limit, it will catch the error, log to `ai_diag` table, and automatically route to the next available provider.

## 4. Wallet/Token Logic (Phase 7)
The current `tx_confirm` flow in `worker/index.ts` mocks the hash. 
The updated flow will:
1. Parse recipient from `user_memory` or CARV.
2. Draft Transaction -> Save to `pending_tx`.
3. Ask user -> Inline buttons.
4. On Confirm: `SessionExecutor` or `WhaleExecutor` uses actual `viem` to broadcast.
5. If `viem` errors or dependencies missing -> **Fail Task Explicitly**.

## 5. Deployment Setup (Phase 8)
- Environment variables will be explicitly documented.
- `wrangler.toml` will be cleaned up.
- Cloudflare deployment scripts will be verified.

---
**Approval required to begin Phase 3 (Safe Cleanup & Consolidation).**
