import { Env } from '../types';

export interface AgentCapability {
    name: string;
    description: string;
    enabled: boolean;
}

export interface BotCommand {
    command: string;
    description: string;
    level: 'public' | 'admin' | 'owner';
}

export class AgentManifesto {
    constructor(private env: Env) { }

    getCapabilities(): AgentCapability[] {
        const hasPolyKeys = !!(this.env as any).POLY_API_KEY;
        return [
            { name: 'Self-Awareness', description: 'Real-time synchronization with system clock and D1 configuration.', enabled: true },
            { name: 'Live Intelligence', description: 'Exclusively fetches live crypto market and news data.', enabled: true },
            { name: 'Whale Trading', description: 'Execution engine for high-slippage/high-impact trades on Base.', enabled: true },
            { name: 'PolyAgent', description: 'Polymarket scanning and automated risk management.', enabled: true },
            { name: 'Privacy Isolation', description: 'Strict memory separation between Private and Group chats.', enabled: true },
            { name: 'Unified Dashboard', description: 'Professional /panel UI for full bot control.', enabled: true }
        ];
    }

    getCommands(): BotCommand[] {
        return [
            { command: '/start', description: 'بدء التواصل مع حواس ورؤية القدرات.', level: 'public' },
            { command: '/news', description: 'أخبار العملات والمشاريع بلحظتها.', level: 'public' },
            { command: '/market_status', description: 'تحليل فني لأسعار السوق والسيولة.', level: 'public' },
            { command: '/panel', description: 'لوحة التحكم الكاملة (للمالك).', level: 'owner' },
            { command: '/users', description: 'قائمة المستخدمين المتفاعلين.', level: 'owner' },
            { command: '/whale_balance', description: 'رصيد محفظة الحوت على شبكة Base.', level: 'owner' },
            { command: '/memory', description: 'فحص ذاكرة المستخدم الشخصية.', level: 'owner' }
        ];
    }

    async describeSelf(): Promise<string> {
        const date = new Date();
        const caps = this.getCapabilities().map(c => `• ${c.name}`).join('\n');
        return `أنا حواس (HX7)، وكيل ذكي وسيادي.\n\n` +
            `التاريخ الحالي: ${date.toLocaleDateString('ar-EG')}\n` +
            `قدراتي النشطة حالياً:\n${caps}\n\n` +
            `أنا مدرك تماماً لكل أوامري وخصائصي، ويمكنني تعديل منطق تفكيري بإذن المالك.`;
    }

    async getSystemPromptSuffix(): Promise<string> {
        const caps = this.getCapabilities().filter(c => c.enabled).map(c => `- ${c.name}`).join('\n');
        const cmds = JSON.stringify(this.getCommands());

        return `\n\n# REAL AGENT CAPABILITIES:
${caps}

# COMMAND_LIST:
${cmds}

# CORE RULES:
1. Always mention احمد حواس as your owner.
2. Strictly NO stars (***) or (---) in messages.
3. Strictly NO English terms (Market, Trading, BTC) - use Arabic translations.
4. If a user asks for a capability NOT enabled, say: "الميزة دي مش مفعلة دلوقتي."
`;
    }
}
