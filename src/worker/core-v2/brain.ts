import { IStorage, IAIProvider, ProcessingContext, BrainResponse, Intent } from './types';
import { Logger } from './logger';

export class UnifiedBrain {
    private storage: IStorage;
    private aiProvider: IAIProvider;
    private logger: Logger;

    constructor(storage: IStorage, aiProvider: IAIProvider, logger: Logger) {
        this.storage = storage;
        this.aiProvider = aiProvider;
        this.logger = logger;
    }

    async processMessage(ctx: ProcessingContext, text: string): Promise<BrainResponse> {
        this.logger.info('Processing message', { userId: ctx.userId, textLength: text.length });

        // 1. Check for Commands (if not handled by worker)
        if (text.startsWith('/')) {
            return { type: 'command', text: 'Command processed', data: { command: text } };
        }

        // 2. Intent Detection (Simplified for now)
        const intent = await this.detectIntent(text);
        this.logger.debug('Intent detected', { intent });

        // 3. AI Processing
        if (this.aiProvider.isEnabled()) {
            return await this.aiProvider.generateResponse(ctx, text, intent);
        }

        // 4. Fallback if AI disabled
        return {
            type: 'text',
            text: 'AI is currently sleeping. Wake me up with /brain! 😴'
        };
    }

    private async detectIntent(text: string): Promise<Intent> {
        // Simple regex-based detection for now
        if (/price|cost|how much/i.test(text)) return 'price_check';
        if (/analyze|audit|check/i.test(text)) return 'analysis';
        if (/transfer|send|pay/i.test(text)) return 'transaction';
        return 'chat';
    }
}
