import { StorageService } from './storage';
import { EventType } from './classifier';

export class PredictionEngine {
    constructor(private storage: StorageService) { }

    async run() {
        console.log('🔮 Running Prediction Engine...');
        try {
            await this.generatePredictions();
            await this.evaluatePredictions();
        } catch (e) {
            console.error('Prediction Engine Error:', e);
        }
    }

    private async generatePredictions() {
        const events = await this.storage.getLatestEvents(100);
        const devUpdates = events.filter(e => e.type === EventType.DevUpdate);

        // Prediction 1: Development shipping
        if (devUpdates.length >= 5) {
            const pending = await this.storage.getPredictions('PENDING');
            if (!pending.some(p => p.title.includes('Dev shipping'))) {
                await this.storage.savePrediction({
                    title: 'Upcoming Dev shipping signal',
                    description: 'Possible new features or stability updates based on GitHub activity.',
                    probability: 75,
                    rationale: `${devUpdates.length} recent code commits detected.`,
                    targetDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000)
                });
            }
        }

        // Prediction 2: Campaign Cycle
        const campaignKeywords = events.filter(e => e.type === EventType.Campaign);
        if (campaignKeywords.length >= 3) {
            const pending = await this.storage.getPredictions('PENDING');
            if (!pending.some(p => p.title.includes('New Campaign'))) {
                await this.storage.savePrediction({
                    title: 'New Campaign/Season imminent',
                    description: 'Patterns in announcements suggest a new event cycle is starting.',
                    probability: 90,
                    rationale: `Detected ${campaignKeywords.length} campaign-related signals.`,
                    targetDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000)
                });
            }
        }
    }

    private async evaluatePredictions() {
        const pending = await this.storage.getPredictions('PENDING');
        const now = new Date();

        for (const p of pending) {
            // Window has passed (we check 1 day after targetDate to be sure)
            if (p.targetDate.getTime() + (24 * 60 * 60 * 1000) < now.getTime()) {
                const events = await this.storage.getLatestEvents(300);
                const relatedEvents = events.filter(e => e.timestamp > p.timestamp);

                let success = false;
                if (p.title.includes('Dev shipping') && relatedEvents.some(e => e.severity === 'high' && e.source === 'GitHub')) {
                    success = true;
                } else if (p.title.includes('New Campaign') && relatedEvents.some(e => e.type === EventType.Campaign)) {
                    success = true;
                }

                if (success) {
                    await this.storage.updatePrediction(p.id, {
                        status: 'CONFIRMED',
                        actualOutcome: 'Event materialized as predicted.',
                        evaluationDate: now
                    });
                } else {
                    await this.storage.updatePrediction(p.id, {
                        status: 'FAILED',
                        actualOutcome: 'Window closed without target event.',
                        evaluationDate: now
                    });
                }
            }
        }
    }
}
