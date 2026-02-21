import { Env, ExecutionContext } from '../types';
import { AiRouter } from '../ai/router';
import { MemoryManager } from './memory';
import { BrainTools } from './tools';

export interface AgentTask {
    id: string;
    goal: string;
    status: 'PENDING' | 'PLANNING' | 'EXECUTING' | 'COMPLETED' | 'FAILED';
    plan: any;
}

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
        const taskId = crypto.randomUUID();

        // 1. Initial Persona Response (Human-like)
        const acknowledgment = `يا هلا يا ${senderName}! أنا فهمت قصدك.. خليني أفكر في "<b>${goal}</b>" وأشوف أقدر أساعدك إزاي. هعمل لك خطة دلوقتي ونبدأ التنفيذ فوراً. 🚀`;

        // 2. Persistent Storage (Async Execution)
        await this.db.prepare(
            "INSERT INTO agent_tasks (id, user_id, goal, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)"
        ).bind(taskId, userId, goal, 'PLANNING', Date.now(), Date.now()).run();

        return { text: acknowledgment, taskId };
    }

    /**
     * The internal "Thinking" loop (ReAct)
     * This will be triggered in the background or after acknowledgment
     */
    async executeAutonomousLoop(taskId: string, userId: string): Promise<void> {
        // Fetch task
        const task = await this.db.prepare("SELECT * FROM agent_tasks WHERE id = ?").bind(taskId).first<any>();
        if (!task) return;

        try {
            // Step 1: Planning
            const plan = await this.generatePlan(task.goal);
            await this.db.prepare("UPDATE agent_tasks SET plan_json = ?, status = ?, updated_at = ? WHERE id = ?")
                .bind(JSON.stringify(plan), 'EXECUTING', Date.now(), taskId).run();

            // Step 2: Sequential Execution
            for (let i = 0; i < plan.steps.length; i++) {
                const step = plan.steps[i];
                const stepId = crypto.randomUUID();

                await this.db.prepare(
                    "INSERT INTO agent_steps (id, task_id, description, action, params_json, order_index, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
                ).bind(stepId, taskId, step.description, step.action, JSON.stringify(step.params), i, 'RUNNING', Date.now(), Date.now()).run();

                const result = await this.executeStep(step);

                await this.db.prepare("UPDATE agent_steps SET result_json = ?, status = ?, updated_at = ? WHERE id = ?")
                    .bind(JSON.stringify(result), 'DONE', Date.now(), stepId).run();
            }

            // Step 3: Reflection & Memory Learning
            await this.learnFromExperience(task.goal, plan);

            await this.db.prepare("UPDATE agent_tasks SET status = ?, updated_at = ? WHERE id = ?")
                .bind('COMPLETED', Date.now(), taskId).run();

        } catch (e: any) {
            console.error('Agency Loop Error:', e);
            await this.db.prepare("UPDATE agent_tasks SET status = ?, updated_at = ? WHERE id = ?")
                .bind('FAILED', Date.now(), taskId).run();
        }
    }

    private async generatePlan(goal: string): Promise<any> {
        const sysPrompt = `You are Hawas HX7 Agent Planner. 
Goal: ${goal}
Output a JSON plan with an array of "steps". Each step has "description", "action", and "params".
Actions: SEARCH, READ_URL, NEWS, MARKET_STATUS, ANALYZE_SENTIMENT, DRAFT_TX.`;

        const res = await this.router.generateReply('PLANNER', "وضع لي خطة تنفيذية للمهمة دي", "", sysPrompt);
        // Extract JSON from response (naive for now)
        try {
            const match = res.text.match(/\{[\s\S]*\}/);
            return JSON.parse(match ? match[0] : res.text);
        } catch {
            return { steps: [{ description: "Direct Action", action: "SEARCH", params: { query: goal } }] };
        }
    }

    private async executeStep(step: any): Promise<any> {
        // Map actions to tool execution
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
