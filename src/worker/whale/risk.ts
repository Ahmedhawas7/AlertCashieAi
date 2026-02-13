export interface RiskConfig {
    max_trade_pct: number;
    daily_loss_limit_usd: number;
    kill_switch: boolean;
}

export class WhaleRisk {
    constructor(private db: D1Database) { }

    async validateTrade(amountUsdc: number, totalBalanceUsdc: number): Promise<{ valid: boolean; error?: string }> {
        // 1. Max trade size check (2%)
        const maxTrade = totalBalanceUsdc * 0.02;
        if (amountUsdc > maxTrade) {
            return { valid: false, error: `Trade size exceeds 2% limit. Max allowed: $${maxTrade.toFixed(2)}` };
        }

        // 2. Kill Switch check
        const killSwitch = await this.getKillSwitch();
        if (killSwitch) {
            return { valid: false, error: "KILL SWITCH is active. All trading blocked." };
        }

        // 3. Daily Loss check
        const dailyLoss = await this.getDailyLoss();
        if (dailyLoss > 50) { // Hard limit $50 loss for safety in v1
            return { valid: false, error: "Daily loss limit reached ($50)." };
        }

        return { valid: true };
    }

    private async getKillSwitch(): Promise<boolean> {
        const res = await this.db.prepare("SELECT value FROM poly_settings WHERE key = 'whale_kill_switch'").first<string>('value');
        return res === 'true';
    }

    private async getDailyLoss(): Promise<number> {
        // Mocked for V1
        return 0;
    }
}
