export interface TokenAuditReport {
    symbol: string;
    name: string;
    address: string;
    chain: string;
    priceUsd: string;
    liquidityUsd: number;
    volume24h: number;
    buys24h: number;
    sells24h: number;
    riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'EXTREME_DANGER';
    riskSummary: string;
    warnings: string[];
}

export class TokenAuditor {
    /**
     * Audit a crypto token contract address for liquidity, volume, honeypot signs, and safety
     */
    static async audit(tokenAddress: string): Promise<string> {
        const cleanAddr = tokenAddress.trim().toLowerCase();
        if (!cleanAddr.startsWith('0x') || cleanAddr.length < 40) {
            return `⚠️ العنوان المدخل (${tokenAddress}) ليس عنوان عقد صالح على شبكة EVM.`;
        }

        try {
            const res = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${cleanAddr}`, {
                headers: { 'Accept': 'application/json', 'User-Agent': 'Mozilla/5.0' }
            });

            if (!res.ok) return `تعذر جلب بيانات العقد حالياً من منصات السيولة.`;

            const data: any = await res.json();
            const pairs = data?.pairs || [];

            if (pairs.length === 0) {
                return `🚨 <b>تحذير أمان عالي:</b>\nالعقد <code>${cleanAddr}</code> غير مسجل في أي مجمع سيولة رئيسي (DEX)، ولا توجد له أزواج تداول معروفة. تجنب التداول عليه لأنه قد يكون غير قابل للبيع.`;
            }

            // Find pair with highest liquidity
            pairs.sort((a: any, b: any) => (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0));
            const bestPair = pairs[0];

            const symbol = bestPair.baseToken?.symbol || 'UNKNOWN';
            const name = bestPair.baseToken?.name || symbol;
            const chain = bestPair.chainId || 'EVM';
            const price = bestPair.priceUsd ? `$${bestPair.priceUsd}` : 'غير محدد';
            const liquidity = bestPair.liquidity?.usd || 0;
            const volume24h = bestPair.volume?.h24 || 0;
            const buys = bestPair.txns?.h24?.buys || 0;
            const sells = bestPair.txns?.h24?.sells || 0;

            const warnings: string[] = [];
            let riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'EXTREME_DANGER' = 'LOW';

            // 1. Check for Honeypot pattern: people can buy, but nobody can sell!
            if (buys > 15 && sells === 0) {
                riskLevel = 'EXTREME_DANGER';
                warnings.push('⛔ <b>اشتباه فخ احتيالي (Honeypot):</b> هناك عمليات شراء ولكن صفر عمليات بيع! على الأرجح العقد يمنع البيع.');
            }

            // 2. Check liquidity depth
            if (liquidity < 3000) {
                riskLevel = riskLevel === 'EXTREME_DANGER' ? 'EXTREME_DANGER' : 'HIGH';
                warnings.push(`⚠️ <b>سيولة ضعيفة جداً ($${Math.round(liquidity).toLocaleString()}):</b> خطر الإنزلاق السعري العالي والتلاعب.`);
            } else if (liquidity < 20000) {
                if (riskLevel === 'LOW') riskLevel = 'MEDIUM';
                warnings.push(`ℹ️ سيولة متوسطة ($${Math.round(liquidity).toLocaleString()}).`);
            }

            // 3. Check transaction ratio
            if (sells > 0 && (buys / sells > 8)) {
                warnings.push('📈 ضغط شراء غير طبيعي مقارنة بالبيع، تأكد من أن البيع غير مقيد بضريبة عالية.');
            }

            let badge = '🟢 <b>مؤشرات السيولة جيدة</b>';
            if (riskLevel === 'EXTREME_DANGER') badge = '🔴 <b>خطر احتيال محتمل (فخ)</b>';
            else if (riskLevel === 'HIGH') badge = '🟠 <b>عالي المخاطر (سيولة منخفضة)</b>';
            else if (riskLevel === 'MEDIUM') badge = '🟡 <b>مخاطرة متوسطة</b>';

            let report = `🛡️ <b>تقرير فحص أمان العقد: ${name} (${symbol})</b>\n\n`;
            report += `⛓️ الشبكة: <b>${chain.toUpperCase()}</b>\n`;
            report += `💰 السعر الحالي: <b>${price}</b>\n`;
            report += `💧 السيولة المتوفرة (Liquidity): <b>$${Math.round(liquidity).toLocaleString()}</b>\n`;
            report += `📊 حجم التداول (24س): <b>$${Math.round(volume24h).toLocaleString()}</b>\n`;
            report += `🔄 حركة الصفقات (24س): 🟢 شراء: ${buys} | 🔴 بيع: ${sells}\n\n`;
            report += `التقييم العام: ${badge}\n`;

            if (warnings.length > 0) {
                report += `\n<b>الملاحظات والتنبيهات:</b>\n` + warnings.join('\n');
            } else {
                report += `\n✅ العقد لديه سيولة جيدة وتداولات بيع وشراء طبيعية.`;
            }

            return report;
        } catch (e: any) {
            return `حدث خطأ أثناء فحص العقد: ${e.message}`;
        }
    }
}
