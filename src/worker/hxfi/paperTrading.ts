import { LiveNews } from '../intel/liveNews';

export interface Position {
    id: string;
    symbol: string;
    amount: number;
    entry_price: number;
    created_at: number;
}

export function normalizeCoinSymbol(sym: string): string {
    const s = (sym || '').trim().toLowerCase();
    if (s.includes('بيتكوين') || s.includes('بتكوين') || s.includes('bitcoin') || s === 'btc') return 'BTC';
    if (s.includes('ايثيريوم') || s.includes('إيثيريوم') || s.includes('اثيريوم') || s.includes('ethereum') || s === 'eth') return 'ETH';
    if (s.includes('سولانا') || s.includes('solana') || s === 'sol') return 'SOL';
    if (s.includes('بينانس') || s.includes('binance') || s === 'bnb') return 'BNB';
    if (s.includes('ريبل') || s.includes('ripple') || s === 'xrp') return 'XRP';
    if (s.includes('دوج') || s.includes('doge') || s.includes('دوجكوين')) return 'DOGE';
    if (s.includes('تون') || s.includes('toncoin') || s === 'ton') return 'TON';
    if (s.includes('بيبي') || s.includes('pepe')) return 'PEPE';
    if (s.includes('سوي') || s.includes('sui')) return 'SUI';
    if (s.includes('شيبا') || s.includes('shib')) return 'SHIB';
    if (s.includes('كاردانو') || s.includes('ada')) return 'ADA';
    if (s.includes('أفالانش') || s.includes('avax')) return 'AVAX';
    return (sym || 'BTC').toUpperCase().replace(/USDT$|USD$/, '').trim();
}

export class PaperTradingService {
    constructor(private db: D1Database) { }

    /**
     * Add a simulated buy position
     */
    async buy(userId: string, symbol: string, amount: number, customPrice?: number): Promise<string> {
        const cleanSymbol = normalizeCoinSymbol(symbol);
        let price = customPrice;

        if (!price || price <= 0) {
            const coins = await LiveNews.fetchCoinsFromText(cleanSymbol);
            price = coins[0]?.current_price || 0;
        }

        if (!price || price <= 0) {
            return `تعذر تحديد سعر الدخول لعملة ${cleanSymbol}. يرجى توضيح السعر يدوياً.`;
        }

        const id = crypto.randomUUID();
        const now = Date.now();

        await this.db.prepare(
            `INSERT INTO paper_positions (id, user_id, symbol, amount, entry_price, created_at)
             VALUES (?, ?, ?, ?, ?, ?)`
        ).bind(id, userId, cleanSymbol, amount, price, now).run();

        const totalCost = (amount * price).toLocaleString(undefined, { maximumFractionDigits: 2 });
        return `✅ <b>تم تسجيل صفقة شراء تجريبية بنجاح!</b>\n\n` +
            `🪙 العملة: <b>${cleanSymbol}</b>\n` +
            `📦 الكمية: <b>${amount}</b>\n` +
            `💵 سعر الدخول: <b>$${price.toLocaleString()}</b>\n` +
            `💰 إجمالي القيمة: <b>$${totalCost}</b>\n\n` +
            `يمكنك متابعة أرباحك في أي وقت بقولك *"وريني محفظتي"*!`;
    }

    /**
     * Sell a simulated position
     */
    async sell(userId: string, symbol: string, amount?: number): Promise<string> {
        const cleanSymbol = normalizeCoinSymbol(symbol);
        const rows = await this.db.prepare(
            `SELECT * FROM paper_positions WHERE user_id = ? AND symbol = ?`
        ).bind(userId, cleanSymbol).all<Position>();

        const positions = rows.results || [];
        if (positions.length === 0) {
            return `ليس لديك أي مراكز مفتوحة لعملة ${cleanSymbol} في المحفظة التجريبية.`;
        }

        const totalHeld = positions.reduce((acc, p) => acc + p.amount, 0);
        const sellAmount = amount && amount > 0 ? Math.min(amount, totalHeld) : totalHeld;

        // Current price
        const coins = await LiveNews.fetchCoinsFromText(cleanSymbol);
        const currentPrice = coins[0]?.current_price || positions[0].entry_price;

        // Average entry
        const avgEntry = positions.reduce((acc, p) => acc + (p.amount * p.entry_price), 0) / totalHeld;
        const pnlUsd = (currentPrice - avgEntry) * sellAmount;
        const pnlPct = ((currentPrice - avgEntry) / avgEntry) * 100;

        // Clear or reduce position
        if (sellAmount >= totalHeld) {
            await this.db.prepare(
                `DELETE FROM paper_positions WHERE user_id = ? AND symbol = ?`
            ).bind(userId, cleanSymbol).run();
        } else {
            // Deduct from oldest
            let remainingToDeduct = sellAmount;
            for (const pos of positions) {
                if (remainingToDeduct <= 0) break;
                if (pos.amount <= remainingToDeduct) {
                    await this.db.prepare(`DELETE FROM paper_positions WHERE id = ?`).bind(pos.id).run();
                    remainingToDeduct -= pos.amount;
                } else {
                    await this.db.prepare(`UPDATE paper_positions SET amount = ? WHERE id = ?`).bind(pos.amount - remainingToDeduct, pos.id).run();
                    remainingToDeduct = 0;
                }
            }
        }

        const sign = pnlUsd >= 0 ? '+' : '';
        const badge = pnlUsd >= 0 ? '🟢 ربح' : '🔴 خسارة';

        return `✅ <b>تم إغلاق صفقة ${cleanSymbol} التجريبية!</b>\n\n` +
            `📦 الكمية المباعة: <b>${sellAmount}</b>\n` +
            `💵 متوسط سعر الشراء: <b>$${avgEntry.toLocaleString(undefined, { maximumFractionDigits: 2 })}</b>\n` +
            `💰 سعر البيع الحالي: <b>$${currentPrice.toLocaleString(undefined, { maximumFractionDigits: 2 })}</b>\n` +
            `📊 النتيجة: <b>${badge} ${sign}$${pnlUsd.toFixed(2)} (${sign}${pnlPct.toFixed(2)}%)</b>`;
    }

    /**
     * Get summary of user's virtual portfolio
     */
    async getPortfolio(userId: string): Promise<string> {
        const rows = await this.db.prepare(
            `SELECT * FROM paper_positions WHERE user_id = ? ORDER BY created_at DESC`
        ).bind(userId).all<Position>();

        const positions = rows.results || [];
        if (positions.length === 0) {
            return `محفظتك التجريبية فارغة حالياً. يمكنك تجربة إضافة صفقة بقولك مثلاً: *"سجل شراء 0.5 بيتكوين"* أو *"اشتريت 5 سولانا"*.`;
        }

        // Group by symbol
        const groups: Record<string, { totalAmount: number; totalCost: number }> = {};
        for (const pos of positions) {
            if (!groups[pos.symbol]) groups[pos.symbol] = { totalAmount: 0, totalCost: 0 };
            groups[pos.symbol].totalAmount += pos.amount;
            groups[pos.symbol].totalCost += pos.amount * pos.entry_price;
        }

        let totalInvested = 0;
        let totalCurrentValue = 0;
        let lines: string[] = [];

        for (const [sym, data] of Object.entries(groups)) {
            const coins = await LiveNews.fetchCoinsFromText(sym);
            const curPrice = coins[0]?.current_price || (data.totalCost / data.totalAmount);
            const curVal = data.totalAmount * curPrice;
            const avgBuy = data.totalCost / data.totalAmount;
            const pnlUsd = curVal - data.totalCost;
            const pnlPct = ((curPrice - avgBuy) / avgBuy) * 100;
            const sign = pnlUsd >= 0 ? '+' : '';
            const icon = pnlUsd >= 0 ? '🟢' : '🔴';

            totalInvested += data.totalCost;
            totalCurrentValue += curVal;

            lines.push(
                `• <b>${sym}</b>: ${data.totalAmount} عملة\n` +
                `   متوسط الشراء: $${avgBuy.toLocaleString(undefined, { maximumFractionDigits: 2 })} | الحالي: $${curPrice.toLocaleString(undefined, { maximumFractionDigits: 2 })}\n` +
                `   الربح/الخسارة: ${icon} <b>${sign}$${pnlUsd.toFixed(2)} (${sign}${pnlPct.toFixed(2)}%)</b>`
            );
        }

        const totalPnlUsd = totalCurrentValue - totalInvested;
        const totalPnlPct = totalInvested > 0 ? (totalPnlUsd / totalInvested) * 100 : 0;
        const totalSign = totalPnlUsd >= 0 ? '+' : '';
        const totalIcon = totalPnlUsd >= 0 ? '🚀 ربح إجمالي' : '📉 خسارة إجمالية';

        return `💼 <b>المحفظة التجريبية اللحظية (Paper Portfolio)</b>\n\n` +
            `💵 رأس المال المستثمر: <b>$${totalInvested.toLocaleString(undefined, { maximumFractionDigits: 2 })}</b>\n` +
            `💎 القيمة السوقية الآن: <b>$${totalCurrentValue.toLocaleString(undefined, { maximumFractionDigits: 2 })}</b>\n` +
            `📊 الأداء الكلي: ${totalIcon}: <b>${totalSign}$${totalPnlUsd.toFixed(2)} (${totalSign}${totalPnlPct.toFixed(2)}%)</b>\n\n` +
            `<b>تفاصيل المراكز المفتوحة:</b>\n` + lines.join('\n\n');
    }

    /**
     * Clear all virtual positions
     */
    async clear(userId: string): Promise<string> {
        await this.db.prepare(`DELETE FROM paper_positions WHERE user_id = ?`).bind(userId).run();
        return `🗑️ تم تصفير محفظتك التجريبية بنجاح. جاهز لبدء تجارب جديدة!`;
    }
}
