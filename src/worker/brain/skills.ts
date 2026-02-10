import { Plan } from './planner';

export interface Skill {
    id: string;
    name: string;
    triggers_json: string;
    steps_md: string;
    safety_rules_md?: string;
}

/**
 * Skill System: Registers and runs procedural tasks stored in D1.
 */
export class SkillSystem {
    private db: D1Database;

    constructor(db: D1Database) {
        this.db = db;
    }

    /**
     * Add a new skill (Owner only)
     */
    async registerSkill(name: string, triggers: string[], steps: string, safety: string = ""): Promise<void> {
        const id = crypto.randomUUID();
        const now = Date.now();
        await this.db.prepare(`
            INSERT INTO skills (id, name, triggers_json, steps_md, safety_rules_md, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `).bind(id, name, JSON.stringify(triggers), steps, safety, now, now).run();
    }

    /**
     * Find a skill matching the input/intent
     */
    async findSkill(text: string): Promise<Skill | null> {
        // Fetch all skills and check triggers
        const res = await this.db.prepare("SELECT * FROM skills").all<Skill>();
        const allSkills = res.results || [];

        for (const skill of allSkills) {
            const triggers: string[] = JSON.parse(skill.triggers_json);
            if (triggers.some(t => text.toLowerCase().includes(t.toLowerCase()))) {
                return skill;
            }
        }
        return null;
    }

    /**
     * Execute a skill - In Hawas Brain v1, this means generating a plan from steps_md
     * and providing it to the brain orchestrator.
     */
    runSkill(skill: Skill): Plan {
        // Convert MD steps to Plan object (simplified parser)
        const lines = skill.steps_md.split('\n').filter(l => l.trim().startsWith('-'));
        const steps = lines.map((line, i) => ({
            id: `skill_step_${i}`,
            description: line.replace('-', '').trim(),
            action: 'INFO',
            params: {},
            status: 'pending' as const
        }));

        return {
            intent: `SKILL_${skill.name.toUpperCase()}`,
            steps,
            isConfirmed: false
        };
    }
}
