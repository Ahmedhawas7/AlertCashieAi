import { Env } from '../types';

export interface AgentStep {
    id: string;
    description: string;
    status: 'pending' | 'in_progress' | 'completed' | 'failed';
    action?: string;
    params?: any;
    error?: string;
    result?: any;
}

export interface AgentTask {
    id: string;
    owner_id: string;
    title: string;
    type: string;
    status: 'pending' | 'in_progress' | 'completed' | 'failed';
    progress_current: number;
    progress_total: number;
    steps: AgentStep[];
    result?: any;
    error?: string;
}

export class TaskEngine {
    constructor(private db: D1Database) { }

    async createTask(ownerId: string, title: string, type: string, steps: AgentStep[]): Promise<string> {
        const id = crypto.randomUUID();
        const now = Date.now();
        await this.db.prepare(
            `INSERT INTO agent_tasks (id, owner_id, title, type, status, progress_current, progress_total, steps_json, created_at, updated_at)
             VALUES (?, ?, ?, ?, 'pending', 0, ?, ?, ?, ?)`
        ).bind(id, ownerId, title, type, steps.length, JSON.stringify(steps), now, now).run();
        return id;
    }

    async updateProgress(taskId: string, currentStepIndex: number, stepStatus: 'in_progress' | 'completed' | 'failed', stepResult?: any, stepError?: string): Promise<void> {
        const taskRow = await this.db.prepare("SELECT * FROM agent_tasks WHERE id = ?").bind(taskId).first<any>();
        if (!taskRow) return;

        let steps: AgentStep[] = JSON.parse(taskRow.steps_json || '[]');
        if (steps[currentStepIndex]) {
            steps[currentStepIndex].status = stepStatus;
            if (stepResult) steps[currentStepIndex].result = stepResult;
            if (stepError) steps[currentStepIndex].error = stepError;
        }

        const current = steps.filter(s => s.status === 'completed').length;
        const isAllDone = current === steps.length;
        const taskStatus = stepStatus === 'failed' ? 'failed' : (isAllDone ? 'completed' : 'in_progress');

        const errorStr = stepError ? stepError : null;
        const resultStr = isAllDone ? JSON.stringify(steps.map(s => s.result)) : null;

        await this.db.prepare(
            `UPDATE agent_tasks 
             SET status = ?, progress_current = ?, steps_json = ?, result_json = ?, error = ?, updated_at = ?
             WHERE id = ?`
        ).bind(taskStatus, current, JSON.stringify(steps), resultStr, errorStr, Date.now(), taskId).run();
    }

    public formatProgress(task: AgentTask): string {
        let msg = `⚙️ **خطة التنفيذ: ${task.progress_current}/${task.progress_total}**\n\n`;
        msg += task.steps.map((s, i) => {
            const icon = s.status === 'completed' ? '✅' : (s.status === 'failed' ? '❌' : (s.status === 'in_progress' ? '⏳' : '⚪'));
            let line = `${icon} ${i + 1}. ${s.description}`;
            if (s.error) line += `\n   ⚠️ *السبب: ${s.error}*`;
            return line;
        }).join('\n');

        if (task.status === 'completed') {
            msg += `\n\n🎉 **تم التنفيذ بنجاح!**`;
        } else if (task.status === 'failed') {
            msg += `\n\n🛑 **فشل التنفيذ.**`;
        }
        return msg;
    }

    async getTask(taskId: string): Promise<AgentTask | null> {
        const row = await this.db.prepare("SELECT * FROM agent_tasks WHERE id = ?").bind(taskId).first<any>();
        if (!row) return null;
        return {
            id: row.id,
            owner_id: row.owner_id,
            title: row.title,
            type: row.type,
            status: row.status,
            progress_current: row.progress_current,
            progress_total: row.progress_total,
            steps: JSON.parse(row.steps_json || '[]'),
            result: row.result_json ? JSON.parse(row.result_json) : undefined,
            error: row.error
        };
    }
}
