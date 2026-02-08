import fs from 'fs';
import path from 'path';
import { Context } from 'telegraf';

export interface SkillSpec {
    name: string;
    description: string;
    inputSchema: any;
}

export interface Skill {
    spec: SkillSpec;
    run(ctx: Context, inputs: any): Promise<any>;
}

export class SkillLoader {
    private skills: Map<string, Skill> = new Map();

    constructor() {
        this.loadSkills();
    }

    private loadSkills() {
        const skillsDir = path.join(__dirname, 'definitions');
        if (!fs.existsSync(skillsDir)) {
            fs.mkdirSync(skillsDir, { recursive: true });
            return;
        }

        const files = fs.readdirSync(skillsDir).filter(f => f.endsWith('.js') || f.endsWith('.ts'));
        for (const file of files) {
            try {
                // Dynamic require/import might neeed careful handling in TS build
                // For now, we assume they are compiled to JS or registered manually if needed
                const skillModule = require(path.join(skillsDir, file));
                const skill = skillModule.default || skillModule;

                if (skill.spec && skill.run) {
                    this.skills.set(skill.spec.name, skill);
                    console.log(`✅ Loaded skill: ${skill.spec.name}`);
                }
            } catch (e) {
                console.error(`Failed to load skill ${file}`, e);
            }
        }
    }

    getSkillsDescription(): string {
        return Array.from(this.skills.values())
            .map(s => `- ${s.spec.name}: ${s.spec.description} (Inputs: ${JSON.stringify(s.spec.inputSchema)})`)
            .join('\n');
    }

    async execute(name: string, inputs: any, ctx: Context) {
        const skill = this.skills.get(name);
        if (!skill) throw new Error(`Skill ${name} not found`);
        return await skill.run(ctx, inputs);
    }

    getSkill(name: string) {
        return this.skills.get(name);
    }

    getAllSkills() {
        return Array.from(this.skills.values());
    }
}
