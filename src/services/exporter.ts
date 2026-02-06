import fs from 'fs';
import path from 'path';
import { StorageService } from './storage';

export class ExporterService {
    constructor(private storage: StorageService) { }

    async export() {
        console.log('📝 Exporting memory snapshot...');
        try {
            await this.exportLabels();
            await this.exportInsights();
            await this.exportPredictions();
            await this.exportRecentEvents();
        } catch (e) {
            console.error('Exporter Error:', e);
        }
    }

    private async exportLabels() {
        const labels = await this.storage.getAllLabels();
        let content = "# Known Contract Labels\n\n";
        labels.forEach(l => content += `- \`${l.address}\`: ${l.name}\n`);
        this.writeFile('contracts', 'known-labels', content);
    }

    private async exportInsights() {
        const insights = await this.storage.getLatestInsights(50);
        let content = "# Recent Ecosystem Insights\n\n";
        insights.forEach(i => {
            const date = i.timestamp.toISOString().split('T')[0];
            content += `## ${i.title} (${date})\n`;
            content += `- **Type**: ${i.type}\n`;
            content += `- **Score**: ${i.score}\n\n`;
            content += `${i.content}\n\n---\n\n`;
        });
        this.writeFile('insights', 'insights', content);
    }

    private async exportPredictions() {
        const predictions = await this.storage.getPredictions();
        let content = "# Ecosystem Predictions\n\n";
        predictions.forEach(p => {
            const statusEmoji = p.status === 'CONFIRMED' ? '✅' : (p.status === 'FAILED' ? '❌' : '⏳');
            content += `## ${statusEmoji} ${p.title}\n`;
            content += `- **Probability**: ${p.probability}%\n`;
            content += `- **Status**: ${p.status}\n`;
            content += `- **Target Date**: ${p.targetDate.toISOString().split('T')[0]}\n`;
            content += `- **Rationale**: ${p.rationale}\n\n`;
            content += `${p.description}\n\n`;
            if (p.actualOutcome) content += `> **Outcome**: ${p.actualOutcome}\n\n`;
            content += "---\n\n";
        });
        this.writeFile('predictions', 'predictions', content);
    }

    private async exportRecentEvents() {
        const events = await this.storage.getLatestEvents(100);
        let content = "# Recent Ecosystem Events\n\n";
        events.forEach(e => {
            content += `- [${e.timestamp.toISOString()}] **${e.source}/${e.type}**: ${e.title} - ${e.summary}\n`;
        });
        this.writeFile('events', 'daily-digests', content);
    }

    private writeFile(category: string, filename: string, content: string) {
        const dir = path.join(process.cwd(), 'memory', category);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(path.join(dir, `${filename}.md`), content, 'utf8');
    }
}
