import { LiveNews } from './liveNews';
import { IntelFormatter } from './formatter';

export class ProactiveMonitor {
    constructor(private db: D1Database) { }

    /**
     * Scan market for high volatility (> 4% swing) and alert owner proactively
     */
    async checkVolatilityAndAlert(ownerTelegramId: string, sendTelegram: (chatId: number, text: string) => Promise<void>): Promise<boolean> {
        if (!ownerTelegramId) return false;
        const ownerId = parseInt(ownerTelegramId);
        if (!ownerId) return false;

        const lastAlertKey = 'last_volatility_alert_ts';
        const lastRow = await this.db.prepare("SELECT value FROM user_memory WHERE key = ? LIMIT 1").bind(lastAlertKey).first<{ value: string }>();
        const lastAlertTs = lastRow ? parseInt(lastRow.value) : 0;
        const now = Date.now();

        // Limit proactive alerts to once every 4 hours max to avoid spamming
        if (now - lastAlertTs < 4 * 60 * 60 * 1000) return false;

        const intel = await LiveNews.fetchLatest();
        const btc = intel.topCoins.find(c => c.symbol === 'btc');
        if (!btc) return false;

        const change = btc.price_change_percentage_24h;
        if (Math.abs(change) >= 4.5) {
            const isPump = change > 0;
            const emoji = isPump ? '🚀🟢' : '⚠️🔴';
            const action = isPump ? 'صعود قوي وتحرك سيولة ملحوظ' : 'هبوط حاد وضغط بيعي ملحوظ';
            const advice = isPump
                ? 'لو محقق أرباح في صفقاتك الفورية ممكن تفكر تأمن جزء من ربحك، أو تنتظر إعادة اختبار الدعم.'
                : 'فرصة ممتازة لمراقبة مستويات الدعم وبدء التجميع على دفعات (DCA) للعملات القوية.';

            const msg = `⚡ <b>حركة سوق قوية ومفاجئة!</b> ${emoji}\n\n` +
                `يا كبير، لاحظت تحرك سريع في البيتكوين (${action}):\n` +
                `• <b>سعر البيتكوين:</b> $${btc.current_price.toLocaleString()} (${change >= 0 ? '+' : ''}${change.toFixed(2)}% في 24س)\n\n` +
                `💡 <b>رؤية حواس السريعة:</b>\n${advice}`;

            await sendTelegram(ownerId, msg);

            // Record timestamp
            await this.db.prepare(
                "INSERT INTO user_memory (key, value, user_id, confidence, updated_at) VALUES (?, ?, ?, 1.0, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at"
            ).bind(lastAlertKey, now.toString(), ownerTelegramId, now).run().catch(() => { });

            return true;
        }

        return false;
    }

    /**
     * Send intelligent daily morning briefing
     */
    async sendMorningBrief(ownerTelegramId: string, sendTelegram: (chatId: number, text: string) => Promise<void>): Promise<void> {
        if (!ownerTelegramId) return;
        const ownerId = parseInt(ownerTelegramId);
        if (!ownerId) return;

        const intel = await LiveNews.fetchLatest(true);
        const report = IntelFormatter.formatMarketStatus(intel);

        const morningMsg = `🌅 <b>صباح الخير يا كبير! يوم موفق ورزق واسع إن شاء الله.</b>\n\n` +
            `جمعت لك نبض السوق وأهم تحركات السيولة لبدء يومك برؤية واضحة:\n\n` +
            `${report}\n\n` +
            `لو حابب ندرس أي فرصة أو تفحص أي عملة، أنا معاك وجاهز في أي وقت! ☕`;

        await sendTelegram(ownerId, morningMsg);
    }
}
