import { LiveNews } from './liveNews';

export interface UserAlert {
    id: string;
    user_id: string;
    coin_symbol?: string;
    condition: 'above' | 'below' | 'reminder';
    target_value: number;
    message?: string;
    is_active: number;
    created_at: number;
    triggered_at?: number;
}

export class AlertService {
    constructor(private db: D1Database) { }

    /**
     * Create a price alert or reminder
     */
    async createAlert(
        userId: string,
        condition: 'above' | 'below' | 'reminder',
        targetValue: number,
        coinSymbol?: string,
        message?: string
    ): Promise<string> {
        const id = crypto.randomUUID();
        const now = Date.now();
        const cleanSymbol = coinSymbol ? coinSymbol.toUpperCase().replace(/USDT$|USD$/, '') : undefined;

        await this.db.prepare(
            `INSERT INTO user_alerts (id, user_id, coin_symbol, condition, target_value, message, is_active, created_at)
             VALUES (?, ?, ?, ?, ?, ?, 1, ?)`
        ).bind(id, userId, cleanSymbol || null, condition, targetValue, message || null, now).run();

        if (condition === 'reminder') {
            const dateStr = new Date(targetValue).toLocaleString('ar-EG', { timeZone: 'Africa/Cairo' });
            return `⏰ <b>تم ضبط التذكير بنجاح!</b>\nسأقوم بتنبيهك تلقائياً في موعد: <b>${dateStr}</b>\nالملاحظة: <i>${message || 'تذكير مجدول'}</i>`;
        }

        const condText = condition === 'above' ? 'يتجاوز (صعوداً)' : 'يهبط دون (نزولاً)';
        return `🔔 <b>تم تفعيل تنبيه الأسعار بنجاح!</b>\n` +
            `🪙 العملة: <b>${cleanSymbol}</b>\n` +
            `🎯 الشرط: عندما ${condText} السعر <b>$${targetValue.toLocaleString()}</b>\n` +
            `سأرسل لك إشعاراً فورياً لحظة تحقق الشرط! 🚀`;
    }

    /**
     * List user's active alerts
     */
    async listAlerts(userId: string): Promise<string> {
        const rows = await this.db.prepare(
            `SELECT * FROM user_alerts WHERE user_id = ? AND is_active = 1 ORDER BY created_at DESC`
        ).bind(userId).all<UserAlert>();

        const alerts = rows.results || [];
        if (alerts.length === 0) {
            return `ليس لديك أي تنبيهات أو تذكيرات نشطة حالياً. جرب أن تطلب مني مثلاً: *"نبهني لما البيتكوين يوصل 85000"* أو *"نبهني لو سولانا نزلت عن 100"*.`;
        }

        let msg = `🔔 <b>تنبيهاتك وتذكيراتك النشطة (${alerts.length}):</b>\n\n`;
        alerts.forEach((a, i) => {
            if (a.condition === 'reminder') {
                const dateStr = new Date(a.target_value).toLocaleString('ar-EG', { timeZone: 'Africa/Cairo' });
                msg += `${i + 1}. ⏰ <b>تذكير:</b> ${dateStr} — <i>${a.message || 'بدون تفاصيل'}</i>\n`;
            } else {
                const cond = a.condition === 'above' ? '📈 أعلى من' : '📉 أقل من';
                msg += `${i + 1}. 🪙 <b>${a.coin_symbol}</b> ${cond} $${a.target_value.toLocaleString()}\n`;
            }
        });

        return msg;
    }

    /**
     * Check all active alerts during Scheduled Cron execution
     */
    async checkAndTriggerAlerts(sendTelegram: (chatId: number, text: string) => Promise<void>): Promise<number> {
        const rows = await this.db.prepare(
            `SELECT * FROM user_alerts WHERE is_active = 1`
        ).all<UserAlert>();

        const alerts = rows.results || [];
        if (alerts.length === 0) return 0;

        const now = Date.now();
        let triggeredCount = 0;

        for (const alert of alerts) {
            let shouldTrigger = false;
            let triggerText = '';

            if (alert.condition === 'reminder') {
                if (now >= alert.target_value) {
                    shouldTrigger = true;
                    triggerText = `⏰ <b>حان موعد التذكير يا ريس!</b>\n\n📝 الملاحظة: <b>${alert.message || 'تذكيرك المجدول'}</b>`;
                }
            } else if (alert.coin_symbol) {
                const coins = await LiveNews.fetchCoinsFromText(alert.coin_symbol);
                const currentPrice = coins[0]?.current_price;

                if (currentPrice) {
                    if (alert.condition === 'above' && currentPrice >= alert.target_value) {
                        shouldTrigger = true;
                        triggerText = `🚨 <b>تنبيه وصول الهدف السعري!</b>\n\n` +
                            `عملة <b>${alert.coin_symbol}</b> تجاوزت هدفك المحدد!\n` +
                            `🎯 الهدف: <b>$${alert.target_value.toLocaleString()}</b>\n` +
                            `💰 السعر اللحظي الآن: <b>$${currentPrice.toLocaleString()}</b> 🚀`;
                    } else if (alert.condition === 'below' && currentPrice <= alert.target_value) {
                        shouldTrigger = true;
                        triggerText = `🚨 <b>تنبيه هبوط سعري!</b>\n\n` +
                            `عملة <b>${alert.coin_symbol}</b> هبطت دون المستوى المحدد!\n` +
                            `🎯 مستوى التنبيه: <b>$${alert.target_value.toLocaleString()}</b>\n` +
                            `💰 السعر اللحظي الآن: <b>$${currentPrice.toLocaleString()}</b> ⚠️`;
                    }
                }
            }

            if (shouldTrigger) {
                const chatId = parseInt(alert.user_id);
                if (chatId) {
                    await sendTelegram(chatId, triggerText);
                }
                await this.db.prepare(
                    `UPDATE user_alerts SET is_active = 0, triggered_at = ? WHERE id = ?`
                ).bind(now, alert.id).run();
                triggeredCount++;
            }
        }

        return triggeredCount;
    }
}
