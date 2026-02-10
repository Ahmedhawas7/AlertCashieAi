import { normalizeText } from './normalize';

/**
 * Evaluator: Analyzes performance and proposes improvements to the owner.
 */
export class Evaluator {
    private db: D1Database;

    constructor(db: D1Database) {
        this.db = db;
    }

    /**
     * Run evaluation loop after an interaction
     */
    async evaluate(userId: string, input: string, output: string, intent: string): Promise<void> {
        const normalizedInput = normalizeText(input);

        // 1. Detect Confusion Phrases
        const confusionSignals = ['مش فاهم', 'بتقول ايه', 'غلط', 'كررت', 'بتكرر', 'wrong', 'repetitive'];
        const isConfused = confusionSignals.some(s => normalizedInput.includes(s));

        if (isConfused) {
            await this.proposeImprovement(
                `User expressed confusion/dissatisfaction with response for intent: ${intent}.`,
                `Input: "${input}"\nResponse: "${output}"`
            );
        }

        // 2. Detect Repetition in Logs
        const recentLogs = await this.db.prepare(`
            SELECT text FROM episodic_logs WHERE user_id = ? ORDER BY ts DESC LIMIT 3
        `).bind(userId).all<{ text: string }>();

        if (recentLogs.results && recentLogs.results.length === 3) {
            const allSame = recentLogs.results.every((l: { text: string }) => normalizeText(l.text) === normalizedInput);
            if (allSame) {
                await this.proposeImprovement(
                    `Detected user repeating same input: "${input}". Existing NLU or Response may be insufficient.`,
                    `Proposal: Add a specific skill or KB entry for this phrase.`
                );
            }
        }
    }

    private async proposeImprovement(reason: string, proposal: string): Promise<void> {
        const id = crypto.randomUUID();
        await this.db.prepare(`
            INSERT INTO skill_proposals (id, proposal_md, reason, created_at)
            VALUES (?, ?, ?, ?)
        `).bind(id, proposal, reason, Date.now()).run();
    }
}
