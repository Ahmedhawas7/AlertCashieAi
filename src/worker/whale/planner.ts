import { WhaleExecutor } from './executor';
import { WhaleRisk } from './risk';
import { Env } from '../types';

export class WhalePlanner {
    private executor: WhaleExecutor;
    private risk: WhaleRisk;

    constructor(private env: Env) {
        this.executor = new WhaleExecutor(env);
        this.risk = new WhaleRisk(env.DB);
    }

    async evaluateOpportunity(opp: any) {
        // Mode check
        const mode = await this.env.DB.prepare("SELECT value FROM poly_settings WHERE key = 'whale_mode'").first<string>('value') || 'OBSERVE';

        if (mode === 'OFF') return null;

        const balances = await this.executor.getBalances();
        const usdcBalance = parseFloat(balances.usdc);

        // Risk check
        const tradeSizeUsdc = 10; // Fixed $10 for v1 safety
        const riskCheck = await this.risk.validateTrade(tradeSizeUsdc, usdcBalance);

        if (!riskCheck.valid) {
            return { action: 'SKIP', reason: riskCheck.error };
        }

        if (mode === 'EXECUTE') {
            return { action: 'TRADE', amount: tradeSizeUsdc, opp };
        }

        return { action: 'ALERT_ONLY', opp };
    }
}
