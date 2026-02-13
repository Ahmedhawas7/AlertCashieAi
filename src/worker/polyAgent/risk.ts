import { PolyDB, PolySettings } from './db';

export class PolyRisk {
    constructor(private db: PolyDB) { }

    async validateTrade(usdAmount: number, settings: PolySettings): Promise<{ safe: boolean; reason?: string }> {
        // 1. Check Max Size
        // We assume a fixed portfolio size or use a hard cap for now.
        // Let's say user manual hard cap is $50 per trade for now.
        const HARD_CAP_USD = 50.0;

        if (usdAmount > HARD_CAP_USD) {
            return { safe: false, reason: `Exceeds hard cap of $${HARD_CAP_USD}` };
        }

        // 2. Check Daily Drawdown (from audit log)
        // TODO: Query poly_audit for today's losses

        return { safe: true };
    }
}
