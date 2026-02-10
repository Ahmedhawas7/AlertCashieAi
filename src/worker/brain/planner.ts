import { NLUResult } from './nlu';
import { MemoryManager } from './memory';

export interface PlanStep {
    id: string;
    description: string;
    action: string;
    params: any;
    status: 'pending' | 'completed' | 'failed';
}

export interface Plan {
    intent: string;
    steps: PlanStep[];
    isConfirmed: boolean;
}

/**
 * Planner: Breaks down complex intents into executable steps.
 */
export class Planner {
    private memory: MemoryManager;

    constructor(memory: MemoryManager) {
        this.memory = memory;
    }

    /**
     * Create a plan based on NLU results
     */
    async createPlan(nlu: NLUResult, userId: string): Promise<Plan | null> {
        if (nlu.intent === 'TRANSFER_INTENT') {
            return await this.createTransferPlan(nlu, userId);
        }
        return null;
    }

    /**
     * Specifically handle the transfer plan logic
     */
    private async createTransferPlan(nlu: NLUResult, userId: string): Promise<Plan> {
        const { amount, token, username, address } = nlu.entities;
        const steps: PlanStep[] = [];

        // 1. Resolve Recipient
        let resolvedRecipient = address || username;
        if (username && !address) {
            // Try to resolve from memory
            const walletFact = await this.memory.getFact(userId, `wallet_${username.replace('@', '').toLowerCase()}`);
            if (walletFact) {
                resolvedRecipient = walletFact.value;
            }
        }

        steps.push({
            id: 'resolve_recipient',
            description: `تحديد المستلم: ${resolvedRecipient || 'غير معروف'}`,
            action: 'RESOLVE',
            params: { recipient: resolvedRecipient },
            status: resolvedRecipient ? 'completed' : 'pending'
        });

        // 2. Draft Transaction
        steps.push({
            id: 'draft_tx',
            description: `تجهيز تحويل ${amount || '?'} ${token || 'USDC'}`,
            action: 'DRAFT',
            params: { amount, token, recipient: resolvedRecipient },
            status: (amount && resolvedRecipient) ? 'completed' : 'pending'
        });

        // 3. User Confirmation
        steps.push({
            id: 'wait_confirm',
            description: 'في انتظار تأكيدك يا ريس',
            action: 'CONFIRM',
            params: {},
            status: 'pending'
        });

        return {
            intent: 'TRANSFER_INTENT',
            steps,
            isConfirmed: false
        };
    }
}
