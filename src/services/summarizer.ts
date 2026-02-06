export class EventSummarizer {
    static summarize(text: string, maxSentences = 2): string {
        if (!text) return '';

        // Simple sentence splitting
        const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
        const summary = sentences.slice(0, maxSentences).join(' ').trim();

        return summary.length > 300 ? summary.slice(0, 297) + '...' : summary;
    }

    static getActionHint(type: string): string {
        switch (type) {
            case 'Announcement': return 'Check the link for details and follow official channels.';
            case 'TokenMovement': return 'Monitor large whale movements for potential market impact.';
            case 'Security': return 'URGENT: Verify contract changes on BaseScan.';
            case 'Governance': return 'Cast your vote if you hold veCARV.';
            default: return 'No immediate action required.';
        }
    }
}
