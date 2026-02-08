import { Context } from 'telegraf';

export const spec = {
    name: 'wallet_readonly_analyzer',
    description: 'Analyzes a wallet address for recent activity and risks.',
    inputSchema: {
        type: 'object',
        properties: {
            chain: { type: 'string', enum: ['BNB', 'ETH', 'BASE'] },
            address: { type: 'string' }
        },
        required: ['chain', 'address']
    }
};

export async function run(ctx: Context, { chain, address }: { chain: string, address: string }) {
    // Mock heuristic for now
    const result = {
        chain,
        address,
        risk_score: 10,
        flags: [] as string[],
        summary: 'No suspicious outgoing transactions in last 24h.'
    };

    if (address.toLowerCase().startsWith('0x0000')) {
        result.risk_score = 90;
        result.flags.push('Suspicious vanity address pattern');
    }

    return result;
}
