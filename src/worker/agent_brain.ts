import { Env, AgentMessage, AgentMemoryItem, AgentSummary, ReplyHistory, BotSettings } from './types';
import { normalizeArabic, calculateSimilarity, rewriteWithVariants, scoreMemory } from './utils';
import { GeminiOrchestrator } from './agent/orchestrator';

/**
 * Advanced AgentBrain with Super Agent Intelligence
 */
export class AgentBrain {
    private db: D1Database;
    private env: Env;
    private chatId: number;
    private orchestrator: GeminiOrchestrator;

    constructor(db: D1Database, env: Env, chatId: number) {
        this.db = db;
        this.env = env;
        this.chatId = chatId;
        this.orchestrator = new GeminiOrchestrator(env);
    }

    /**
     * Thinking Pipeline: Plan -> Answer -> Self-Check
     */
    async think(userInput: string, senderName: string): Promise<string> {
        // 1. Retrieval: Context + Relevant Memories
        const context = await this.getContext(20);
        const memories = await this.retrieveMemories(userInput);
        const settings = await this.getSettings();
        const recentReplies = await this.getRecentReplies(5);

        let finalResponse = "";

        // 2. Super Agent Orchestration
        if (settings.ai_enabled && this.env.GEMINI_API_KEY) {
            const result = await this.orchestrator.think(userInput, senderName, context, memories);

            if (result.toolCalls) {
                // Execute Tool Calls (Simplified for now - can be expanded to a loop)
                const toolResults = await this.handleToolCalls(result.toolCalls);
                // Re-think with tool results (Recursive one-step)
                const finalResult = await this.orchestrator.think(
                    `Tool Results: ${JSON.stringify(toolResults)}\nBased on this, respond to: ${userInput}`,
                    senderName, context, memories
                );
                finalResponse = finalResult.text;
            } else {
                finalResponse = result.text;
            }
        } else {
            // Fallback to Deterministic Brain
            const intent = this.detectIntent(userInput);
            finalResponse = await this.generateDraftDeterministic(userInput, senderName, intent, memories, context, settings);
        }

        // 3. Self-Check (Anti-repeat, Egyptian)
        finalResponse = await this.selfCheck(finalResponse, senderName, recentReplies, settings.persona);

        // 4. Persistence & Extraction
        await this.persistTurn(userInput, finalResponse);
        await this.autoExtractMemory(userInput, finalResponse);

        return finalResponse;
    }

    /**
     * Phase 2: Natural Egyptian Conversational Intelligence
     */
    async generateHawasReply(userInput: string, senderName: string): Promise<string> {
        const context = await this.getContext(10);
        const memories = await this.retrieveMemories(userInput);
        const settings = await this.getSettings();

        // Check for specific identity memory first
        const identity = memories.find(m => m.type === 'identity');
        const nameInMem = memories.find(m => m.key === 'name')?.value || senderName;

        if (settings.ai_enabled && this.env.GEMINI_API_KEY) {
            const systemPrompt = `أنت "حواس"، وكيل ذكي وسيادي مصري 🇪🇬. 
تتحدث بلهجة مصرية عامية طبيعية جداً (لهجة ولاد البلد).
مهمتك مساعدة المستخدم في إدارة معاملاته على شبكة Base وفهم بيانات CARV ID.
ذاكرتك الحالية: ${JSON.stringify(memories)}
اسم المستخدم: ${nameInMem}

قواعد:
1. لا تكرر نفسك.
2. كن ودوداً ولكن عملياً.
3. إذا وجدت معلومة في الذاكرة، استخدمها ولا تقل "أنا بتعلم".
4. لو المستخدم سألك عن نفسه، جاوبه من الذاكرة (identity).`;

            const result = await this.orchestrator.think(userInput, nameInMem, context, memories, systemPrompt);
            const answer = result.text;

            // Phase 2 Fix: Persist context even in conversational mode
            await this.persistTurn(userInput, answer);
            await this.autoExtractMemory(userInput, answer);

            return answer;
        }

        // Deterministic Fallback with better Egyptian phrasing
        const intent = this.detectIntent(userInput);
        const answer = await this.generateDraftDeterministic(userInput, nameInMem, intent, memories, context, settings);

        await this.persistTurn(userInput, answer);
        await this.autoExtractMemory(userInput, answer);

        return answer;
    }

    private async handleToolCalls(toolCalls: any[]): Promise<any[]> {
        const results = [];
        for (const call of toolCalls) {
            if (call.name === "get_user_memories") {
                const memories = await this.retrieveMemories(call.args.query);
                results.push({ tool: call.name, result: memories });
            }
            if (call.name === "prepare_transfer") {
                // Return structured data for HawasBrain to handle or persist as pending_tx
                results.push({ tool: call.name, success: true, message: "Transaction initialized. User needs to confirm." });
            }
            if (call.name === "search_web") {
                results.push({ tool: call.name, result: "Web search is currently in limited preview. Showing best matched local data." });
            }
        }
        return results;
    }

    private detectIntent(text: string): string {
        const normalized = normalizeArabic(text);
        if (normalized.includes("ازيك") || normalized.includes("عامل ايه") || normalized.includes("صباح")) return "greeting";
        if (normalized.includes("انا مين") || normalized.includes("تعرف ايه عني") || normalized.includes("هويتي")) return "identity";
        if (normalized.includes("شكرا") || normalized.includes("تسلم") || normalized.includes("حبيبي")) return "thanks";
        return "question";
    }

    private async generateDraftDeterministic(
        userInput: string,
        senderName: string,
        intent: string,
        memories: AgentMemoryItem[],
        context: AgentMessage[],
        settings: BotSettings
    ): Promise<string> {
        if (intent === "identity") {
            const identityMatch = memories.find(m => (m.score || 0) >= 10);
            if (identityMatch) return `بص يا غالي، إنت ${identityMatch.value}. تحب أفتكرك بحاجة تانية؟`;
            return `أنا أخوك حواس، مساعدك الشخصي.. بس قولي إنت مين عشان أفتكرك المرة الجاية؟`;
        }
        if (memories.length > 0) {
            const best = memories[0];
            return `بخصوص ${best.key}، اللي أعرفه إن ${best.value}.. صح كده؟`;
        }
        if (intent === "greeting") return `يا أهلا بيك يا ${senderName}، نورتني والله.`;
        return `والله يا ${senderName}، لسه بتعلم في الموضوع ده.. بس معاك في أي وقت.`;
    }

    private async getContext(limit: number = 20): Promise<AgentMessage[]> {
        try {
            const res = await this.db.prepare("SELECT role, text FROM messages WHERE chat_id = ? ORDER BY ts DESC LIMIT ?").bind(this.chatId, limit).all<AgentMessage>();
            return (res.results || []).reverse();
        } catch (e) {
            console.error('getContext DB Error:', e);
            return [];
        }
    }

    private async retrieveMemories(query: string): Promise<AgentMemoryItem[]> {
        try {
            const res = await this.db.prepare("SELECT * FROM memories WHERE chat_id = ? AND deprecated = 0").bind(this.chatId).all<AgentMemoryItem>();
            if (!res.results) return [];
            const scored = res.results.map(m => ({ ...m, score: scoreMemory(query, m.key, m.value) })).filter(m => (m.score || 0) > 0).sort((a, b) => (b.score || 0) - (a.score || 0) || b.ts - a.ts);
            return scored.slice(0, 10);
        } catch (e) {
            console.error('retrieveMemories DB Error:', e);
            return [];
        }
    }

    private async getRecentReplies(limit: number = 5): Promise<string[]> {
        const res = await this.db.prepare("SELECT reply FROM reply_history WHERE chat_id = ? ORDER BY ts DESC LIMIT ?").bind(this.chatId, limit).all<ReplyHistory>();
        return (res.results || []).map(r => r.reply);
    }

    private async selfCheck(draft: string, name: string, recentReplies: string[], persona: string): Promise<string> {
        let answer = draft;
        const tooSimilar = recentReplies.some(r => calculateSimilarity(answer, r) > 0.6);
        const lastReply = recentReplies[0];
        if (tooSimilar || (lastReply && calculateSimilarity(answer, lastReply) > 0.5)) {
            answer = rewriteWithVariants(answer, name, recentReplies);
        } else if (!answer.includes("يا") && !answer.includes("بص")) {
            answer = rewriteWithVariants(answer, name, recentReplies);
        }
        return answer;
    }

    private async persistTurn(input: string, output: string): Promise<void> {
        try {
            const now = Date.now();
            await this.db.prepare("INSERT INTO messages (chat_id, role, text, ts) VALUES (?, 'user', ?, ?)").bind(this.chatId, input, now).run();
            await this.db.prepare("INSERT INTO messages (chat_id, role, text, ts) VALUES (?, 'bot', ?, ?)").bind(this.chatId, output, now).run();
            await this.db.prepare("INSERT INTO reply_history (chat_id, reply, ts) VALUES (?, ?, ?)").bind(this.chatId, output, now).run();
            await this.db.prepare("DELETE FROM messages WHERE chat_id = ? AND id NOT IN (SELECT id FROM messages WHERE chat_id = ? ORDER BY ts DESC LIMIT 50)").bind(this.chatId, this.chatId).run();
        } catch (e) {
            console.error('persistTurn DB Error:', e);
        }
    }

    private async autoExtractMemory(input: string, output: string): Promise<void> {
        const now = Date.now();
        const normalized = normalizeArabic(input);

        // 1. Identity Extraction (Phase 1/3)
        if (normalized.includes("انا اسمي") || normalized.includes("اسمي ")) {
            const name = input.split(/اسمي/i)[1]?.trim();
            if (name) {
                await this.teach('name', name, 'identity');
                return;
            }
        }

        // 2. Generic Preference Extraction
        if (normalized.includes("افتكر") || normalized.includes("سجل عندك") || normalized.includes("خلي بالك")) {
            const clean = input.replace(/افتكر|سجل عندك|خلي بالك|يا حواس|حواس|ان/gi, "").trim();
            if (clean.length > 2) {
                await this.teach(clean.slice(0, 30), clean, 'preference');
            }
        }
    }

    /**
     * Phase 3: CARV Identity Awareness
     */
    async getPrimaryWalletFromCARVID(carvId: string): Promise<string | null> {
        const res = await this.db.prepare(
            "SELECT smart_wallet_address FROM connections WHERE carv_id = ? OR telegram_user_id = ? LIMIT 1"
        ).bind(carvId, carvId).first<{ smart_wallet_address: string }>();

        return res?.smart_wallet_address || null;
    }

    async resolveUsernameToWallet(username: string): Promise<string | null> {
        const cleanUsername = username.replace('@', '').toLowerCase();
        const res = await this.db.prepare(
            "SELECT value FROM memories WHERE key = ? AND type = 'wallet' LIMIT 1"
        ).bind(`wallet_${cleanUsername}`).first<{ value: string }>();

        return res?.value || null;
    }

    async getSettings(): Promise<BotSettings> {
        try {
            const res = await this.db.prepare("SELECT * FROM bot_settings WHERE chat_id = ?").bind(this.chatId).first<BotSettings>();
            if (res) return res;
        } catch (e) {
            console.error('getSettings DB Error:', e);
        }
        return {
            chat_id: this.chatId,
            persona: (this.env.DEFAULT_PERSONA as any) || 'calm',
            ai_enabled: (this.env.AI_ENABLED_DEFAULT === 'true' ? 1 : 0),
            daily_ai_limit: 10,
            ai_calls_today: 0
        };
    }

    async teach(key: string, value: string, type: string = 'fact'): Promise<void> {
        await this.db.prepare("INSERT INTO memories (chat_id, type, key, value, ts, tags) VALUES (?, ?, ?, ?, ?, ?)").bind(this.chatId, type, key, value, Date.now(), 'direct').run();
    }

    async forget(keyword: string): Promise<number> {
        const normalized = `%${normalizeArabic(keyword)}%`;
        const res = await this.db.prepare("UPDATE memories SET deprecated = 1 WHERE chat_id = ? AND (key LIKE ? OR value LIKE ?)").bind(this.chatId, normalized, normalized).run();
        return (res.meta as any).changes || 0;
    }

    async getMemoryDump(limit: number = 20): Promise<string> {
        const res = await this.db.prepare("SELECT type, key, value FROM memories WHERE chat_id = ? AND deprecated = 0 ORDER BY ts DESC LIMIT ?").bind(this.chatId, limit).all<AgentMemoryItem>();
        if (!res.results || res.results.length === 0) return "الذاكرة لسه فاضية يا ريس.";
        return "🧠 **ذاكرتي فيها إيه:**\n" + res.results.map(m => `• [${m.type}] ${m.key}: ${m.value}`).join("\n");
    }

    async resetContext(): Promise<void> {
        await this.db.prepare("DELETE FROM messages WHERE chat_id = ?").bind(this.chatId).run();
    }
}
