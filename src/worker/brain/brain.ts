import { Env, SessionKey, PendingTx } from '../types';
import { NLUParser, NLUResult } from './nlu';
import { MemoryManager } from './memory';
import { KnowledgeBase } from './kb';
import { RetrievalEngine } from './retrieve';
import { Planner, Plan } from './planner';
import { SkillSystem } from './skills';
import { Evaluator } from './evaluator';
import { WebResearcher } from './researcher';
import { SessionExecutor } from '../agent/sessionExecutor';
import { getVariant } from './templates';
import { AiRouter, AiResult } from '../ai/router';
import { AgentMemoryItem } from '../types';
import { FreeAiSearch } from '../freeai/search';
import { composeAnswer, formatCitations } from '../freeai/answer';

/**
 * HawasBrain: The hybrid orchestrator for the Sovereign Agent (v2).
 * Combines deterministic logic with AI-powered Deep Research (DeepSeek).
 */
export class BrainV2 {
    private db: D1Database;
    private env: Env;
    private nlu: NLUParser;
    private memory: MemoryManager;
    private kb: KnowledgeBase;
    private retrieval: RetrievalEngine;
    private planner: Planner;
    private skills: SkillSystem;
    private evaluator: Evaluator;
    private researcher: WebResearcher;
    private aiRouter: AiRouter;

    constructor(db: D1Database, env: Env) {
        this.db = db;
        this.env = env;
        this.nlu = new NLUParser();
        this.memory = new MemoryManager(db);
        this.kb = new KnowledgeBase(db);
        this.retrieval = new RetrievalEngine(this.kb, db);
        this.planner = new Planner(this.memory);
        this.skills = new SkillSystem(db);
        this.evaluator = new Evaluator(db);
        this.researcher = new WebResearcher(this.kb, env);
        this.aiRouter = new AiRouter(env);
    }

    async handleMessage(userId: string, senderName: string, text: string): Promise<string> {
        const aiEnabled = await this.isAiEnabled(userId);
        const withinQuota = aiEnabled ? await this.checkAndIncrementAiQuota(userId) : false;
        const nluResult = this.nlu.parse(text);

        const skill = await this.skills.findSkill(text);
        if (skill) {
            const plan = this.skills.runSkill(skill);
            return this.formatPlanResponse(plan, senderName);
        }

        if (nluResult.intent === 'DEEP_RESEARCH') {
            const query = text.replace(/بحث عميق|دور اوي|بحث|search/gi, "").trim();
            if (query) return await this.researcher.deepResearch(query);
        }

        const plan = await this.planner.createPlan(nluResult, userId);
        if (plan) return this.formatPlanResponse(plan, senderName);

        if (aiEnabled && withinQuota) {
            const context = await this.packageAiContext(userId, text);
            const aiResult = await this.aiRouter.generateReply(userId, text, context);
            await this.updateAiDiag(userId, aiResult);

            if (aiResult.text && !aiResult.error) {
                await this.finalizeInteraction(userId, text, nluResult, aiResult.text);
                return aiResult.text;
            } else if (aiResult.error) {
                console.error(`AI Brain Error (${aiResult.provider}):`, aiResult.error);
                const offlineFallback = await this.getOfflineResponse(userId, senderName, text, nluResult);
                return `في مشكلة اتصال بسيطة، كملتلك بالوضع العادي.\n\n${offlineFallback}`;
            }
        }

        return await this.getOfflineResponse(userId, senderName, text, nluResult);
    }

    private async getOfflineResponse(userId: string, senderName: string, text: string, nluResult: NLUResult): Promise<string> {
        if (nluResult.intent === 'WHOAMI') {
            const nameFact = await this.memory.getFact(userId, 'name');
            const response = getVariant('WHOAMI', "", {
                name: nameFact?.value || senderName,
                preferences: 'إدارة معاملاتك على Base'
            });
            await this.finalizeInteraction(userId, text, nluResult, response);
            return response;
        }

        let response = "";
        const freeSearch = new FreeAiSearch(this.db);
        const citations = await freeSearch.search(text, 3);

        if (citations.length > 0) {
            const aiResult = composeAnswer(text, citations);
            response = aiResult.answer + formatCitations(aiResult.citations);
        } else {
            const searchResults = await this.retrieval.retrieve(userId, text);
            if (searchResults.length > 0 && searchResults[0].score > 20) {
                const best = searchResults[0];
                const sourceInfo = best.source === 'kb' ? `(المصدر: ${best.title})` : `(من كلامنا قبل كدة)`;
                response = `بص يا ريس، اللي أعرفه إن ${best.text} ${sourceInfo}`;
            } else {
                if (nluResult.intent === 'UNKNOWN' && text.length > 10) {
                    response = await this.researcher.deepResearch(text);
                } else {
                    response = getVariant(nluResult.intent);
                }
            }
        }

        if (nluResult.intent === 'UNKNOWN' && text.length > 20) {
            if (text.includes("سجل") || text.includes("احفظ") || text.includes("عارف ان")) {
                const fact = text.replace(/سجل|احفظ|عارف ان/gi, "").trim();
                await this.kb.addDoc(`User Fact: ${userId}`, fact, "auto_learned");
                response = `تمام يا ريس، سجلت المعلومة دي عندي في الذاكرة السيادية. 🧠✨`;
            }
        }

        if (nluResult.intent === 'UNKNOWN' && (text.includes("اسمي") || text.includes("انا اسمي"))) {
            const nameMatch = text.match(/(?:اسمي|انا اسمي)\s+([\u0621-\u064A\w\s]+)/i);
            const name = nameMatch ? nameMatch[1].trim() : null;
            if (name) {
                await this.memory.storeFact(userId, 'name', name);
                response = `تشرفنا يا ${name}! سجلت اسمك عندي خلاص.`;
            }
        }

        await this.finalizeInteraction(userId, text, nluResult, response);
        return response;
    }

    private async isAiEnabled(userId: string): Promise<boolean> {
        const setting = await this.db.prepare(
            "SELECT ai_enabled FROM ai_user_settings WHERE user_id = ?"
        ).bind(userId).first<{ ai_enabled: number }>();
        if (!setting) return this.env.AI_ENABLED_DEFAULT === "true";
        return setting.ai_enabled === 1;
    }

    private async checkAndIncrementAiQuota(userId: string): Promise<boolean> {
        const today = new Date().toISOString().split('T')[0];
        const limit = parseInt(this.env.AI_DAILY_LIMIT || "99999");
        const usage = await this.db.prepare(
            "SELECT call_count FROM ai_usage WHERE user_id = ? AND usage_date = ?"
        ).bind(userId, today).first<{ call_count: number }>();
        const count = usage?.call_count || 0;
        if (count >= limit) return false;
        if (!usage) {
            await this.db.prepare("INSERT INTO ai_usage (user_id, usage_date, call_count) VALUES (?, ?, 1)").bind(userId, today).run();
        } else {
            await this.db.prepare("UPDATE ai_usage SET call_count = call_count + 1 WHERE user_id = ? AND usage_date = ?").bind(userId, today).run();
        }
        return true;
    }

    private async packageAiContext(userId: string, text: string): Promise<string> {
        const facts = await this.db.prepare("SELECT key, value FROM user_memory WHERE user_id = ? ORDER BY updated_at DESC LIMIT 5").bind(userId).all<{ key: string, value: string }>();
        const memoryContext = (facts.results && facts.results.length > 0) ? "USER FACTS:\n" + facts.results.map(f => `- ${f.key}: ${f.value}`).join("\n") : "";
        const history = await this.db.prepare("SELECT text FROM episodic_logs WHERE user_id = ? ORDER BY ts DESC LIMIT 3").bind(userId).all<{ text: string }>();
        const historyContext = (history.results && history.results.length > 0) ? "RECENT MESSAGES:\n" + history.results.reverse().map(h => `- ${h.text}`).join("\n") : "";
        const kbResults = await this.retrieval.retrieve(userId, text);
        const kbContext = kbResults.length > 0 ? "KNOWLEDGE:\n" + kbResults.slice(0, 2).map(k => `- ${k.text.substring(0, 200)}`).join("\n") : "";
        return `${memoryContext}\n\n${historyContext}\n\n${kbContext}`.trim();
    }

    public async setAiToggle(userId: string, enabled: boolean): Promise<void> {
        await this.db.prepare(
            "INSERT INTO ai_user_settings (user_id, ai_enabled, updated_at) VALUES (?, ?, ?) " +
            "ON CONFLICT(user_id) DO UPDATE SET ai_enabled = EXCLUDED.ai_enabled, updated_at = EXCLUDED.updated_at"
        ).bind(userId, enabled ? 1 : 0, Date.now()).run();
    }

    private async updateAiDiag(userId: string, result: AiResult) {
        const today = new Date().toISOString().split('T')[0];
        const isSuccess = result.status >= 200 && result.status < 300 && !!result.text;
        await this.db.prepare(
            "INSERT INTO ai_diag (user_id, today_date, today_calls, last_success_provider, last_error_provider, last_status, last_error, last_latency, updated_at) " +
            "VALUES (?, ?, 1, ?, ?, ?, ?, ?, ?) " +
            "ON CONFLICT(user_id) DO UPDATE SET " +
            "today_date = EXCLUDED.today_date, " +
            "today_calls = CASE WHEN today_date = EXCLUDED.today_date THEN today_calls + 1 ELSE 1 END, " +
            "last_success_provider = CASE WHEN ? THEN EXCLUDED.last_success_provider ELSE last_success_provider END, " +
            "last_error_provider = CASE WHEN ? THEN last_error_provider ELSE EXCLUDED.last_error_provider END, " +
            "last_status = EXCLUDED.last_status, " +
            "last_error = EXCLUDED.last_error, " +
            "last_latency = EXCLUDED.last_latency, " +
            "updated_at = EXCLUDED.updated_at"
        ).bind(userId, today, isSuccess ? result.provider : null, isSuccess ? null : result.provider, result.status, result.error || null, result.latencyMs, Date.now(), isSuccess, isSuccess).run();
    }

    public async getAiDiag(userId: string): Promise<string> {
        const diag = await this.db.prepare("SELECT * FROM ai_diag WHERE user_id = ?").bind(userId).first<any>();
        const enabled = await this.isAiEnabled(userId);
        const limit = parseInt(this.env.AI_DAILY_LIMIT || "50");
        if (!diag) return `AI Mode: ${enabled ? 'ON' : 'OFF'}\nStatus: No record yet.`;
        return `📊 **Hawas AI Diag**\n` +
            `- AI Enabled: ${enabled}\n` +
            `- Calls Today: ${diag.today_calls}/${limit}\n` +
            `- Last Success: ${diag.last_success_provider || 'None'}\n` +
            `- Last Error: ${diag.last_error_provider || 'None'} (${diag.last_status})\n` +
            `- Error Msg: ${diag.last_error ? diag.last_error.substring(0, 50) : 'None'}\n` +
            `- Last Latency: ${diag.last_latency}ms\n` +
            `- Updated: ${new Date(diag.updated_at).toLocaleTimeString()}`;
    }

    public async testAi(userId: string): Promise<string> {
        try {
            const result = await this.aiRouter.generateReply(userId, "say OK");
            if (result.text && !result.error) {
                return `✅ **AI Test: OK**\n- Provider: ${result.provider}\n- Latency: ${result.latencyMs}ms`;
            } else {
                return `❌ **AI Test Failed**\n- Provider: ${result.provider}\n- Status: ${result.status}\n- Error: ${result.error || 'Empty Content'}`;
            }
        } catch (e: any) {
            return `❌ **AI Test Crash**\n- Error: ${e.message}`;
        }
    }

    async handleExecuteIntent(userId: string): Promise<string> {
        const pending = await this.db.prepare("SELECT * FROM pending_tx WHERE user_id = ? AND status = 'pending' ORDER BY created_at DESC LIMIT 1").bind(userId).first<PendingTx>();
        if (!pending) return "⚠️ مفيش عمليات معلقة حالياً.";
        const session = await this.db.prepare("SELECT * FROM session_keys WHERE user_id = ? AND expires_at > ? AND wallet_address != 'WAITING' ORDER BY created_at DESC LIMIT 1").bind(userId, Date.now()).first<SessionKey>();
        if (!session) return "⚠️ الجلسة منتهية أو مش موجودة. سجل دخول بـ /authorize الأول.";
        const executor = new SessionExecutor(this.env);
        const result = await executor.executeTransfer(session.session_private_key as `0x${string}`, pending.recipient as `0x${string}`, pending.amount, (this.env.USDC_BASE_ADDRESS || '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913') as `0x${string}`, pending.token);
        if (result.success && result.hash) {
            await this.db.prepare("UPDATE pending_tx SET status = 'executed', tx_hash = ? WHERE id = ?").bind(result.hash, pending.id).run();
            return `✅ **تمت العملية بنجاح!**\n\nالهاش: \`${result.hash}\`\n[عرض على BaseScan](https://basescan.org/tx/${result.hash})`;
        } else {
            await this.db.prepare("UPDATE pending_tx SET status = 'failed' WHERE id = ?").bind(pending.id).run();
            return `❌ **فشلت العملية:**\n${result.error}`;
        }
    }

    private formatPlanResponse(plan: Plan, name: string): string {
        const tpl = getVariant(plan.intent);
        const nextStep = plan.steps.find(s => s.status === 'pending');
        let response = tpl.replace('{name}', name).replace('{amount}', plan.steps[1]?.params?.amount || '').replace('{token}', plan.steps[1]?.params?.token || '').replace('{recipient}', plan.steps[1]?.params?.recipient || 'المستحق');
        if (nextStep) response += `\n\n**الخطوة الجاية:** ${nextStep.description}`;
        return response;
    }

    private async finalizeInteraction(userId: string, input: string, nlu: NLUResult, output: string) {
        await this.memory.logEpisode(userId, input, nlu.intent, nlu.entities, output);
        await this.evaluator.evaluate(userId, input, output, nlu.intent);
    }
}
