import { LiveIntel } from './liveNews';

const translations: Record<string, string> = {
    'Bitcoin': 'بتكوين',
    'Ethereum': 'إيثيريوم',
    'Market': 'السوق',
    'Market Cap': 'القيمة السوقية',
    'Trending': 'الرائج',
    'Volume': 'حجم التداول',
    'Price': 'السعر',
    'Change': 'التغيير',
    'Opportunity': 'فرصة الموازنة',
    'Active': 'نشط',
    'Observation': 'مراقبة',
    'Analysis': 'تحليل'
};

function t(text: string): string {
    return translations[text] || text;
}

export class IntelFormatter {
    private static formatPrecisionTime(ts: number): string {
        const date = new Date(ts);
        // Explicit Cairo Offset (UTC+2) - Can be dynamic if needed
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
        const btc = intel.topCoins?.find(c => c.symbol === 'btc');
        const eth = intel.topCoins?.find(c => c.symbol === 'eth');

        let report = `📊 <b>تحديث وضع السوق اللحظي</b>\n\n`;
        report += `📅 الوقت: ${timeStr} (بتوقيت القاهرة)\n\n`;

        if (btc) {
            report += `🪙 <b>بتكوين (BTC)</b>: $${btc.current_price.toLocaleString()}\n`;
            report += `📈 التغيير (24س): ${btc.price_change_percentage_24h.toFixed(2)}%\n\n`;
        }

        if (eth) {
            report += `🪙 <b>إيثيريوم (ETH)</b>: $${eth.current_price.toLocaleString()}\n`;
            report += `📈 التغيير (24س): ${eth.price_change_percentage_24h.toFixed(2)}%\n\n`;
        }

        if (intel.global) {
            const cap = (intel.global.total_market_cap.usd / 1e12).toFixed(2);
            report += `🌐 <b>إجمالي القيمة السوقية</b>: $${cap} تريليون\n`;
            report += `🔥 هيمنة بتكوين: ${intel.global.market_cap_percentage.btc.toFixed(1)}%\n\n`;
        }

        if (intel.trendingBase && intel.trendingBase.length > 0) {
            report += `🚀 <b>الرائج على شبكة Base</b>:\n`;
            intel.trendingBase.slice(0, 3).forEach(p => {
                report += `• ${p.baseToken.symbol}/${p.quoteToken.symbol}: $${p.priceUsd} (${p.priceChange.h24}%)\n`;
            });
        }

        return report;
    }

    static formatNewsReport(intel: LiveIntel, topic?: string): string {
        const timeStr = this.formatPrecisionTime(intel.timestamp);
        let report = `🚨 <b>خبر عاجل — تحديث استخباراتي</b>\n\n`;
        report += `الوقت: ${timeStr} (بتوقيت القاهرة)\n\n`;

        const primaryNews = intel.news?.[0];
        report += `<b>ملخص سريع</b>:\n${primaryNews ? primaryNews.title : 'هدوء حذر في الأسواق مع استقرار أحجام التداول.'}\n\n`;

        report += `<b>تفاصيل</b>:\n`;
        if (intel.topCoins) {
            const btc = intel.topCoins[0];
            const direction = btc.price_change_percentage_24h > 0 ? 'صاعد' : 'هابط';
            report += `يتحرك سعر بتكوين حالياً عند مستوى $${btc.current_price.toLocaleString()} مع زخم ${direction}.\n`;
        }

        if (intel.polyMarkets && intel.polyMarkets.length > 0) {
            report += `على منصة بولي ماركت، هناك اهتمام متزايد بتوقعات الأسواق.\n`;
        }

        report += `\n<b>التأثير المتوقع</b>:\n`;
        report += `• زيادة السيولة على الشبكات اللامركزية\n`;
        report += `• ترقب جماعي لتحركات الأسعار القادمة\n`;

        report += `\n<b>تحليل حواس (HX7)</b>:\n`;
        const trend = (intel.global && intel.global.market_cap_change_percentage_24h_usd > 0) ? 'إيجابي' : 'حذر';
        report += `الاتجاه العام للسوق يميل للجانب الـ ${trend}. ننصح بمتابعة مستويات السيولة بدقة.`;

        return report;
    }
}
