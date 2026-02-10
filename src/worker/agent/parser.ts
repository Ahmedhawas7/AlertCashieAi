import { normalizeArabic } from '../utils';

export interface ParsedTx {
    intent: 'transfer' | 'execute' | 'cancel' | 'none';
    amount?: string;
    token?: string;
    recipient?: string;
}

/**
 * Conversational Parser for Transaction Intents
 */
export function parseTxIntent(text: string): ParsedTx {
    const normalized = normalizeArabic(text);

    // 1. Detection of Execution Intent
    if (normalized === "نفذ" || normalized === "اكد" || normalized.includes("execute") || normalized.includes("confirm")) {
        return { intent: 'execute' };
    }

    if (normalized === "إلغاء" || normalized === "كنسل" || normalized.includes("cancel")) {
        return { intent: 'cancel' };
    }

    // 2. Detection of Transfer Intent
    const transferKeywords = ["ابعت", "حول", "ارسل", "هات", "send", "transfer", "pay"];
    const isTransfer = transferKeywords.some(kw => normalized.includes(kw));

    if (isTransfer) {
        // Simple Regex for Amount + Token + Recipient
        // Example: "ابعت 1 USDC ل @أحمد"
        const amountMatch = text.match(/(\d+(\.\d+)?)/);
        const tokenMatch = text.match(/(USDC|ETH|USDT|GEM)/i);
        const recipientMatch = text.match(/(@\w+|0x[a-fA-F0-9]{40})/);

        return {
            intent: 'transfer',
            amount: amountMatch ? amountMatch[1] : undefined,
            token: tokenMatch ? tokenMatch[1].toUpperCase() : 'USDC', // Default to USDC if amount found
            recipient: recipientMatch ? recipientMatch[1] : undefined
        };
    }

    return { intent: 'none' };
}
