import { Context } from 'telegraf';

export const spec = {
    name: 'link_scanner',
    description: 'Analyzes a URL for security risks (phishing, malware, suspicious patterns).',
    inputSchema: {
        type: 'object',
        properties: {
            url: { type: 'string', description: 'The URL to scan' }
        },
        required: ['url']
    }
};

export async function run(ctx: Context, { url }: { url: string }) {
    // Mock Implementation
    const risks: string[] = [];
    let score = 100;
    const lowerUrl = url.toLowerCase();

    // 1. Check for suspicious TLDs
    const suspiciousTLDs = ['.xyz', '.top', '.ru', '.cn', '.tk'];
    if (suspiciousTLDs.some(tld => lowerUrl.includes(tld))) {
        score -= 20;
        risks.push('Suspicious TLD detected');
    }

    // 2. IP check
    if (/^http:\/\/(\d{1,3}\.){3}\d{1,3}/.test(lowerUrl)) {
        score -= 40;
        risks.push('Direct IP address usage');
    }

    let verdict = 'SAFE';
    if (score < 50) verdict = 'DANGEROUS';
    else if (score < 80) verdict = 'CAUTION';

    return {
        url,
        score,
        verdict,
        risks: risks.length > 0 ? risks : ['None found']
    };
}
