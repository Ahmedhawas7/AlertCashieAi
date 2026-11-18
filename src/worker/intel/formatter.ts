import { LiveIntel } from './liveNews';

export class IntelFormatter {
    private static formatPrecisionTime(ts: number): string {
        const date = new Date(ts);
        const cairoTime = new Date(date.getTime() + (2 * 60 * 60 * 1000));

        const day = cairoTime.getUTCDate();
        const monthNames = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];
        const month = monthNames[cairoTime.getUTCMonth()];
        const year = cairoTime.getUTCFullYear();
        const hours = cairoTime.getUTCHours().toString().padStart(2, '0');
        const minutes = cairoTime.getUTCMinutes().toString().padStart(2, '0');

        return `${day} ${month} ${year} — ${hours}:${minutes}`;
    }

    static formatMarketStatus(intel: LiveIntel): string {
        const timeStr = this.formatPrecisionTime(intel.timestamp);
        let report = `📊 <b>تحديث وضع السوق اللحظي</b>\n`;
        report += `📅 الوقت: ${timeStr} (بتوقيت القاهرة)\n\n`;

        if (intel.topCoins && intel.topCoins.length > 0) {
            report += `💰 <b>أسعار العملات الرئيسية</b>:\n`;
            for (const coin of intel.topCoins) {
                const sign = coin.price_change_percentage_24h >= 0 ? '+' : '';
                const icon = coin.price_change_percentage_24h >= 0 ? '🟢' : '🔴';
                report += `• <b>${coin.name} (${coin.symbol.toUpperCase()})</b>: $${coin.current_price.toLocaleString()} ${icon} (${sign}${coin.price_change_percentage_24h.toFixed(2)}%)\n`;
            }
            report += `\n`;
        }

        if (intel.global) {
            const cap = (intel.global.total_market_cap?.usd / 1e12 || 2.75).toFixed(2);
            report += `🌐 <b>القيمة السوقية الإجمالية</b>: $${cap} تريليون\n`;
            if (intel.global.market_cap_percentage?.btc) {
                report += `🔥 هيمنة بتكوين (BTC Dominance): ${intel.global.market_cap_percentage.btc.toFixed(1)}%\n\n`;
            }
        }

        if (intel.trendingBase && intel.trendingBase.length > 0) {
            report += `🚀 <b>أزواج رائجة على شبكة Base</b>:\n`;
            intel.trendingBase.slice(0, 3).forEach(p => {
                if (p.baseToken?.symbol && p.quoteToken?.symbol) {
                    report += `• ${p.baseToken.symbol}/${p.quoteToken.symbol}: $${p.priceUsd} (${p.priceChange?.h24 || 0}%)\n`;
                }
            });
            report += `\n`;
        }

        if (intel.news && intel.news.length > 0) {
            report += `📰 <b>أبرز العناوين الحية</b>:\n`;
            intel.news.slice(0, 2).forEach(n => {
                report += `• ${n.title}\n`;
            });
        }

        return report.trim();
    }

    static formatNewsReport(intel: LiveIntel, topic?: string): string {
        const timeStr = this.formatPrecisionTime(intel.timestamp);
        let report = `🚨 <b>آخر أخبار وتحليلات السوق</b>\n`;
        report += `الوقت: ${timeStr} (بتوقيت القاهرة)\n\n`;

        if (intel.news && intel.news.length > 0) {
            report += `<b>العناوين العاجلة</b>:\n`;
            intel.news.slice(0, 4).forEach((n, idx) => {
                report += `${idx + 1}. ${n.title}\n`;
            });
            report += `\n`;
        } else {
            report += `استقرار نسبي في وتيرة الأخبار مع مراقبة حركة السيولة.\n\n`;
        }

        if (intel.topCoins && intel.topCoins.length > 0) {
            const btc = intel.topCoins.find(c => c.symbol === 'btc') || intel.topCoins[0];
            const direction = btc.price_change_percentage_24h >= 0 ? 'صاعد 📈' : 'هابط أو تصحيحي 📉';
            report += `<b>نبض الأسعار</b>:\n`;
            report += `البتكوين يتحرك عند $${btc.current_price.toLocaleString()} باتجاه ${direction} (${btc.price_change_percentage_24h.toFixed(2)}% في 24س).\n`;
        }

        return report.trim();
    }
}
