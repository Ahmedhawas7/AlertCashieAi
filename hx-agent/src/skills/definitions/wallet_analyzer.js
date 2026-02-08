module.exports = {
    spec: {
        name: 'wallet_readonly_analyzer',
        description: 'Analyzes a wallet address for recent activity and risks (Read-Only).',
        parameters: {
            type: 'object',
            properties: {
                chain: {
                    type: 'string',
                    description: 'Blockchain (e.g., BNB, ETH)',
                    enum: ['BNB', 'ETH', 'BASE']
                },
                address: {
                    type: 'string',
                    description: 'Wallet Address'
                }
            },
            required: ['chain', 'address']
        }
    },
    run: async (ctx, { chain, address }) => {
        const result = {
            chain,
            address,
            risk_score: 10,
            flags: [],
            recent_activity_summary: 'No suspicious outgoing transactions in last 24h.'
        };

        // Mock heuristic
        if (address.toLowerCase().startsWith('0x0000')) {
            result.risk_score = 90;
            result.flags.push('Suspicious vanity address pattern');
        }

        return result;
    }
};
