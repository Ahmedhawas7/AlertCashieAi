import { normalizeText } from './normalize';

export type Intent =
    | 'GREET' | 'HELP' | 'WHOAMI' | 'CONNECT' | 'STATUS' | 'PLAN' | 'DIGESTNOW'
    | 'TRANSFER_INTENT' | 'TX_CONFIRM' | 'TX_CANCEL'
    | 'KB_SEARCH' | 'KB_ADD' | 'KB_LIST'
    | 'DEEP_RESEARCH' | 'DISTRIBUTE'
    | 'TROUBLESHOOT' | 'EXPLAIN' | 'SUMMARIZE'
    | 'GENERAL'  // Added for conversational filler
    | 'UNKNOWN';

export interface Entities {
    amount?: string;
    token?: string;
    username?: string;
    address?: string;
    chain?: string;
    txhash?: string;
}

export interface NLUResult {
    intent: Intent;
    entities: Entities;
    confidence: number;
}

/**
 * Deterministic NLU for Hawas Brain v1
 */
export class NLUParser {

    /**
     * Parse text for intent and entities using regex and phrase patterns
     */
    parse(text: string): NLUResult {
        const normalized = normalizeText(text);
        let intent: Intent = 'UNKNOWN';
        let confidence = 0.5;

        // 1. Intent Detection (Simplified Rule-based)
        if (this.matchGroup(normalized, ['ازيك', 'يا هلا', 'صباح', 'مساء', 'سلام', 'hi', 'hello'])) {
            intent = 'GREET';
        } else if (this.matchGroup(normalized, ['ساعدني', 'مساعدة', ' help', 'الأوامر'])) {
            intent = 'HELP';
        } else if (this.matchGroup(normalized, ['انا مين', 'تعرف ايه عني', 'اسمي', 'مين انا'])) {
            intent = 'WHOAMI';
        } else if (this.matchGroup(normalized, ['اربط', 'وصل', 'لينك', 'connect'])) {
            intent = 'CONNECT';
        } else if (this.matchGroup(normalized, ['الحالة', 'جاهز', 'status'])) {
            intent = 'STATUS';
        } else if (this.matchGroup(normalized, ['ابعت', 'حول', 'ارسل', 'هات', 'send', 'transfer', 'pay'])) {
            intent = 'TRANSFER_INTENT';
        } else if (this.matchGroup(normalized, ['اكد', 'نفذ', 'تمام', 'ماشي', 'confirm', 'execute'])) {
            intent = 'TX_CONFIRM';
        } else if (this.matchGroup(normalized, ['إلغاء', 'كنسل', 'لا خلاص', 'cancel'])) {
            intent = 'TX_CANCEL';
        } else if (this.matchGroup(normalized, ['ابحث', 'دور', 'search', 'معلومات عن'])) {
            intent = 'KB_SEARCH';
        } else if (this.matchGroup(normalized, ['بحث عميق', 'دور اوي', 'البحث العميق', 'deep research'])) {
            intent = 'DEEP_RESEARCH';
        } else if (this.matchGroup(normalized, ['وزع', 'ايردروب', 'اير دروب', 'distribute', 'airdrop'])) {
            intent = 'DISTRIBUTE';
        } else if (this.matchGroup(normalized, ['ضيف معلومة', 'سجل معلومة', 'kb_add'])) {
            intent = 'KB_ADD';
        } else if (this.matchGroup(normalized, ['كل المعلومات', 'قائمة', 'kb_list'])) {
            intent = 'KB_LIST';
        } else if (this.matchGroup(normalized, ['مشكلة', 'مش شغال', 'عطل', 'troubleshoot'])) {
            intent = 'TROUBLESHOOT';
        } else if (this.matchGroup(normalized, ['اشرح', 'يعني ايه', 'explain'])) {
            intent = 'EXPLAIN';
        } else if (this.matchGroup(normalized, ['لخص', 'خلاصة', 'ملخص', 'summarize'])) {
            intent = 'SUMMARIZE';
        }

        // 2. Entity Extraction
        const entities: Entities = {};

        // Amount
        const amountMatch = text.match(/(\d+(\.\d+)?)/);
        if (amountMatch) entities.amount = amountMatch[1];

        // Token
        const tokenMatch = text.match(/(USDC|ETH|USDT|GEM|ايثيريوم)/i);
        if (tokenMatch) {
            const t = tokenMatch[1].toUpperCase();
            entities.token = t === 'ايثيريوم' ? 'ETH' : t;
        } else if (entities.amount) {
            entities.token = 'USDC'; // Default
        }

        // Wallet Address
        const addrMatch = text.match(/(0x[a-fA-F0-9]{40})/);
        if (addrMatch) entities.address = addrMatch[1];

        // Telegram Username
        const userMatch = text.match(/(@\w+)/);
        if (userMatch) entities.username = userMatch[1];

        // Chain
        if (normalized.includes('base') || normalized.includes('بيز')) entities.chain = 'Base';

        // Tx Hash
        const hashMatch = text.match(/(0x[a-fA-F0-9]{64})/);
        if (hashMatch) entities.txhash = hashMatch[1];

        // Refine Confidence
        if (intent !== 'UNKNOWN') confidence = 0.9;
        if (intent === 'TRANSFER_INTENT' && (entities.amount || entities.username || entities.address)) confidence = 1.0;

        return { intent, entities, confidence };
    }

    private matchGroup(text: string, phrases: string[]): boolean {
        return phrases.some(p => text.includes(normalizeText(p)));
    }
}
