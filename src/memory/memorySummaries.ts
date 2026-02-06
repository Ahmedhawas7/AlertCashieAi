import { StorageService } from '../services/storage';
import { MemoryStore } from './memoryStore';

export class MemorySummaries {
    constructor(private storage: StorageService, private memory: MemoryStore) { }

    public async generateInsights() {
        const recentEvents = await this.storage.getLatestEvents(50);
        const now = Date.now();
        const twoMinutesAgo = now - 2 * 60 * 1000;
        const oneHourAgo = now - 60 * 60 * 1000;

        // Pattern 1: High frequency alerts (Spam/Burst)
        const highFreqEvents = recentEvents.filter(e => e.timestamp.getTime() > twoMinutesAgo);
        if (highFreqEvents.length >= 5) {
            await this.memory.append('insights', 'patterns', `Detected high frequency activity (${highFreqEvents.length} events in 2m). Possible network event or major movement.`);
        }

        // Pattern 2: Whale Movement Detection
        const tokenMovements = recentEvents.filter(e =>
            e.timestamp.getTime() > oneHourAgo &&
            (e.title.includes('TokenMovement') || e.title.includes('💰'))
        );
        if (tokenMovements.length >= 3) {
            await this.memory.append('insights', 'whale', `🚨 WHALE ALERT: Detected ${tokenMovements.length} major token movements in the last hour. Potential market shift or large player activity.`);
        }

        // Pattern 3: Keywords in Medium
        const campaignKeywords = ['campaign', 'snapshot', 'season', 'airdrop', 'whitelist'];
        for (const event of recentEvents) {
            if (event.type === 'MediumRSS' || event.title.toLowerCase().includes('medium')) {
                const lowerTitle = event.title.toLowerCase();
                const lowerSummary = event.summary.toLowerCase();

                for (const kw of campaignKeywords) {
                    if (lowerTitle.includes(kw) || lowerSummary.includes(kw)) {
                        await this.memory.append('admin', 'suggestions', `Campaign detected: "${event.title}". PROACTIVE: Suggest creators prepare engagement posts and devs check contract updates.`);
                    }
                }
            }
        }
    }

    public async getActionHints(focus: 'creator' | 'dev' | 'both'): Promise<string[]> {
        const hints: string[] = [];
        const suggestions = await this.memory.read('admin', 'suggestions');
        const lines = suggestions.split('\n').filter(l => l.trim() !== '').slice(-5);

        if (focus === 'creator' || focus === 'both') {
            hints.push("💡 Creator Tip: Use the latest Medium keywords for better SEO in your X posts.");
            hints.push("💡 Proactive: Check the 'suggestions' memory for trending topics.");
        }

        if (focus === 'dev' || focus === 'both') {
            hints.push("🛠 Dev Tip: Monitor 'insights/patterns' for unusual contract activity spikes.");
            hints.push("🛠 Proactive: Verify any mentioned 'snapshot' dates in the latest alerts.");
        }

        return [...hints, ...lines.map(l => `Suggestion: ${l.replace(/^-\s+\[.*?\]\s+/, '')}`)];
    }

    public async getOfflineKnowledge(query: string): Promise<string> {
        // Collect everything from memory files related to the query
        const categories = ['admin', 'events', 'contracts', 'rules', 'insights'];
        let context = "";

        for (const cat of categories as any[]) {
            const files = await this.memory.listFiles(cat);
            for (const file of files) {
                const content = await this.memory.read(cat, file);
                const matches = content.split('\n').filter(line =>
                    line.toLowerCase().includes(query.toLowerCase()) &&
                    !line.includes('[DEPRECATED]')
                );
                if (matches.length > 0) {
                    context += matches.join('\n') + '\n';
                }
            }
        }

        return context || "No local records found for this query.";
    }
}
