import { PolyClient } from './client';
import { Env } from '../types';
import { PolyDB } from './db';

interface Opportunity {
    id: string;
    question: string;
    market_slug: string;
    sum_probabilities: number;
    mispricing_pct: number; // 1.0 - sum
    details: string;
    token_ids: string[];
    prices: number[];
}

export class PolyScanner {
    constructor(
        private client: PolyClient,
        private db: PolyDB,
        private env: Env
    ) { }

    async scan(): Promise<Opportunity[]> {
        const settings = await this.db.getSettings();
        if (settings.mode === 'OFF') return [];

        const markets = await this.client.fetchMarkets(100); // Scan top 100 strictly
        const opportunities: Opportunity[] = [];

        for (const market of markets) {
            // 1. Basic Sum Check (using Last Traded Prices from Gamma first, cheap)
            // Note: outcomePrices are string representations of floats
            const prices = market.outcomePrices.map(p => parseFloat(p));
            if (prices.length < 2) continue;

            const sum = prices.reduce((a, b) => a + b, 0);

            // Check for negative mispricing (Sum < 1.0)
            // "Buy all outcomes for less than $1"
            if (sum < (1.0 - settings.min_mispricing_pct)) {
                // 2. Validate with real OrderBook (Expensive, do only if promising)
                // For MVP, we pass the Gamma hint.

                opportunities.push({
                    id: market.id,
                    question: market.question,
                    market_slug: market.slug,
                    sum_probabilities: sum,
                    mispricing_pct: (1.0 - sum) * 100,
                    details: `Sum: ${sum.toFixed(3)} (${market.outcomePrices.join(' + ')})`,
                    token_ids: market.clobTokenIds,
                    prices: prices
                });
            }
        }

        return opportunities;
    }
}
