import { Env, ExecutionContext } from '../types';
import { AiRouter } from '../ai/router';
import { MemoryManager } from './memory';
import { BrainTools } from './tools';
import { TaskEngine, AgentTask, AgentStep } from '../agent/tasks';

export class AgencySystem {
    private db: D1Database;
    private env: Env;
    private router: AiRouter;
    private memory: MemoryManager;
    private tools: BrainTools;

    constructor(db: D1Database, env: Env) {
        this.db = db;
        this.env = env;
        this.router = new AiRouter(env);
        this.memory = new MemoryManager(db);
        this.tools = new BrainTools(db, env);
    }

    /**
     * Main entry point for autonomous mission execution
     */
    async undertakeMission(userId: string, goal: string, senderName: string): Promise<{ text: string, taskId: string }> {
        const engine = new TaskEngine(this.db);
        const steps: AgentStep[] = [
            { id: crypto.randomUUID(), description: 'جاري التخطيط والتحليل...', status: 'pending' }
        ];

        const taskId = await engine.createTask(userId, goal, 'MISSION', steps);

        const acknowledgment = `يا هلا يا ${senderName}! أنا فهمت قصدك.. هبدأ أشتغل على "<b>${goal}</b>" وأبلغك بالتحديثات أول بأول. 🚀`;

        return { text: acknowledgment, taskId };
    }

    /**
     * The internal "Thinking" loop (ReAct)
     * This will be triggered in the background or after acknowledgment
     */
    async executeAutonomousLoop(taskId: string, userId: string): Promise<void> {
        const engine = new TaskEngine(this.db);
        const task = await engine.getTask(taskId);
        if (!task) return;

        try {
            await engine.updateProgress(taskId, 0, 'in_progress');

            // Step 1: Planning
            const plan = await this.generatePlan(task.title);

            // Rewrite Steps
            const newSteps: AgentStep[] = plan.steps.map((s: any) => ({
                id: crypto.randomUUID(),
                description: s.description,
                status: 'pending',
                action: s.action,
                params: s.params
            }));

            await this.db.prepare(
                `UPDATE agent_tasks SET steps_json = ?, progress_total = ?, updated_at = ? WHERE id = ?`
            ).bind(JSON.stringify(newSteps), newSteps.length, Date.now(), taskId).run();

            // Step 2: Sequential Execution
            for (let i = 0; i < newSteps.length; i++) {
                await engine.updateProgress(taskId, i, 'in_progress');
                await this.sendLiveUpdate(userId, taskId, engine);

                const step = newSteps[i];
                const result = await this.executeStep(step);

                if (result && result.error) {
                    throw new Error(result.error);
                }

                await engine.updateProgress(taskId, i, 'completed', result);
            }

            // Step 3: Reflection & Memory Learning
            await this.learnFromExperience(task.title, plan);
            await this.sendLiveUpdate(userId, taskId, engine);

        } catch (e: any) {
            console.error('Agency Loop Error:', e);
            const currentTask = await engine.getTask(taskId);
            if (currentTask) {
                const pendingIdx = currentTask.steps.findIndex(s => s.status === 'in_progress' || s.status === 'pending');
                if (pendingIdx !== -1) {
                    await engine.updateProgress(taskId, pendingIdx, 'failed', undefined, e.message);
                } else {
                    await this.db.prepare("UPDATE agent_tasks SET status = 'failed', error = ? WHERE id = ?").bind(e.message, taskId).run();
                }
                await this.sendLiveUpdate(userId, taskId, engine);
            }
        }
    }

    private async sendLiveUpdate(userId: string, taskId: string, engine: TaskEngine) {
        const task = await engine.getTask(taskId);
        if (!task || !this.env.BOT_TOKEN) return;

        const msg = engine.formatProgress(task);

        const url = `https://api.telegram.org/bot${this.env.BOT_TOKEN}/sendMessage`;
        try {
            await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ chat_id: userId, text: msg, parse_mode: 'Markdown' })
            });
        } catch (e) { console.error("Live Update Error", e) }
    }

    private async generatePlan(goal: string): Promise<any> {
        const sysPrompt = `You are Hawas HX7 Agent Planner. 
Goal: ${goal}
Output a JSON plan with an array of "steps". Each step has "description", "action", and "params".
Actions: SEARCH, READ_URL, NEWS, MARKET_STATUS, ANALYZE_SENTIMENT, DRAFT_TX.`;

        const res = await this.router.generateReply('PLANNER', "وضع لي خطة تنفيذية للمهمة دي", "", sysPrompt);
        try {
            const match = res.text.match(/\{[\s\S]*\}/);
            return JSON.parse(match ? match[0] : res.text);
        } catch {
            return { steps: [{ description: "Direct Action", action: "SEARCH", params: { query: goal } }] };
        }
    }

    private async executeStep(step: any): Promise<any> {
        switch (step.action) {
            case 'SEARCH':
                return await this.tools.executeTool('freeai_search', { query: step.params.query });
            case 'ASK':
                return await this.tools.executeTool('freeai_ask', { question: step.params.question });
            case 'NEWS':
                return await this.tools.executeTool('news', {});
            case 'MARKET_STATUS':
                return await this.tools.executeTool('market_status', {});
            default:
                return await this.tools.executeTool(step.action.toLowerCase(), step.params);
        }
    }

    private async learnFromExperience(goal: string, plan: any) {
        await this.db.prepare(
            "INSERT INTO agent_experience (goal_category, goal_query, successful_plan_json, last_used_at) VALUES (?, ?, ?, ?)"
        ).bind('GENERAL', goal, JSON.stringify(plan), Date.now()).run();
    }
}
