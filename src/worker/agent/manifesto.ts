import { Env } from '../types';
import { PolyAgent } from '../polyAgent';

export interface AgentCapability {
    name: string;
    enabled: boolean;
    description: string;
}

export const CORE_RULES = [
    "Never hallucinate capabilities.",
    "Always know your capabilities.",
    "Truth over politeness.",
    "Tool-first response.",
    "Persistent memory enforcement.",
    "Private vs Group behavior.",
    "No fake transfer claims."
];

export class AgentManifesto {
    constructor(private env: Env) { }

    getCapabilities(): AgentCapability[] {
        // Dynamic check based on Env/Secrets
        const hasPolyKeys = !!(this.env as any).POLY_API_KEY;
        const hasD1 = !!this.env.DB;
        const isOwnerSet = !!this.env.OWNER_TELEGRAM_ID;

        return [
            { name: "Polymarket Scanner", enabled: hasD1, description: "Can scan markets for opportunities." },
            { name: "Risk Engine", enabled: hasD1, description: "Validates trade safety against limits." },
            { name: "Trade Executor", enabled: hasPolyKeys, description: "Can execute trades (Requires API Keys)." },
            { name: "Memory System", enabled: hasD1, description: "Persistent storage for context and settings." },
            { name: "Owner Gates", enabled: isOwnerSet, description: "Restricts sensitive actions to owner." },
            { name: "Remote Browser", enabled: false, description: "Not yet implemented." },
            { name: "YouTube Search", enabled: false, description: "Not yet implemented." },
            { name: "CARV Reader", enabled: true, description: "Can read CARV ID data via OAuth." }
        ];
    }

    async validateCapability(capabilityName: string): Promise<boolean> {
        const caps = this.getCapabilities();
        const cap = caps.find(c => c.name === capabilityName);
        return cap ? cap.enabled : false;
    }

    async getSystemPromptSuffix(): Promise<string> {
        const caps = this.getCapabilities().filter(c => c.enabled).map(c => `- ${c.name}`).join('\n');
        return `
\n\n# REAL AGENT CAPABILITIES (TRUTH):
${caps}

# CORE MANIFESTO:
${CORE_RULES.map((r, i) => `${i + 1}. ${r}`).join('\n')}

If a user asks for a capability NOT listed above, you MUST say: "Capability not enabled yet."
`;
    }
}
