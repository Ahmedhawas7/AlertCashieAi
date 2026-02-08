module.exports = {
    spec: {
        name: 'link_scanner',
        description: 'Analyzes a URL for security risks (phishing, malware, suspicious patterns).',
        parameters: {
            type: 'object',
            properties: {
                url: {
                    type: 'string',
                    description: 'The URL to scan'
                }
            },
            required: ['url']
        }
    },
    run: async (ctx, { url }) => {
        // Mock Implementation
        // In real world, use Google Safe Browsing or similar APIs

        const risks = [];
        let score = 100; // Start with safe

        const lowerUrl = url.toLowerCase();

        // 1. Check for suspicious TLDs
        const suspiciousTLDs = ['.xyz', '.top', '.ru', '.cn', '.tk'];
        if (suspiciousTLDs.some(tld => lowerUrl.includes(tld))) {
            score -= 20;
            risks.push('Suspicious TLD detected');
        }

        // 2. Check for IP address URLs
        if (/^http:\/\/(\d{1,3}\.){3}\d{1,3}/.test(lowerUrl)) {
            score -= 40;
            risks.push('Direct IP address usage');
        }

        // 3. Check for overly long URLs
        if (url.length > 100) {
            score -= 10;
            risks.push('Wait, that URL is unusually long');
        }

        // 4. Return result
        let veredict = 'SAFE';
        if (score < 50) veredict = 'DANGEROUS';
        else if (score < 80) veredict = 'CAUTION';

        return {
            url,
            score,
            veredict,
            risks: risks.length > 0 ? risks : ['None found']
        };
    }
};
