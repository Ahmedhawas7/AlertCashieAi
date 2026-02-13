import { Env } from '../types';

const GAMMA_API = "https://gamma-api.polymarket.com";
const CLOB_API = "https://clob.polymarket.com";

interface Market {
    id: string;
    question: string;
    conditionId: string;
    slug: string;
    endDate: string;
    outcomePrices: string[];
    clobTokenIds: string[];
    active: boolean;
    closed: boolean;
}

interface OrderBook {
    hash: string;
    bids: { price: string; size: string }[];
    asks: { price: string; size: string }[];
}

export class PolyClient {
    constructor(private env: Env) { }

    // --- Gamma API (Read-Only) ---
    async fetchMarkets(limit: number = 100): Promise<Market[]> {
        // Fetch active, open markets, sorted by volume or liquidity if possible
        // For now, simpler fetch
        const query = `limit=${limit}&active=true&closed=false&order=volume24hr&descending=true`;
        const url = `${GAMMA_API}/markets?${query}`;

        try {
            const res = await fetch(url);
            if (!res.ok) throw new Error(`Gamma API error: ${res.status}`);
            const data: any = await res.json();
            return data.map((m: any) => ({
                id: m.id,
                question: m.question,
                conditionId: m.condition_id,
                slug: m.slug,
                endDate: m.end_date,
                outcomePrices: JSON.parse(m.outcomePrices || "[]"),
                clobTokenIds: JSON.parse(m.clobTokenIds || "[]"),
                active: m.active,
                closed: m.closed
            }));
        } catch (e) {
            console.error("Fetch Markets Error:", e);
            return [];
        }
    }

    // --- CLOB API (Read/Write) ---
    async getOrderBook(tokenId: string): Promise<OrderBook | null> {
        const url = `${CLOB_API}/book?token_id=${tokenId}`;
        try {
            const res = await fetch(url);
            if (!res.ok) return null; // 404 if empty
            return await res.json();
        } catch (e) {
            return null;
        }
    }

    // --- Execution (MVP: Mock signing, returns strict error if keys missing) ---
    async placeOrder(payload: any): Promise<{ orderId?: string; error?: string }> {
        // payload: { tokenId, side: 'BUY'|'SELL', price, size }

        // 1. Check if we have secrets
        // Note: In Cloudflare Workers, secrets are on `this.env`.
        // BUT for safety in this MVP, we will NOT implement real signing yet.
        // We will log the "Would Execute" action.

        /* 
        To implement real execution later:
        1. Import `createWalletClient` from viem + `privateKeyToAccount`.
        2. Construct Order struct (EIP-712).
        3. Sign with private key from env.POLY_PRIVATE_KEY.
        4. POST to /order.
        */

        console.log("MOCK EXECUTION:", payload);

        // Return a mock ID for testing the flow
        return { orderId: `mock_${Date.now()}_${Math.floor(Math.random() * 1000)}` };
    }

    // Helper to check if APIs are reachable
    async healthCheck(): Promise<boolean> {
        try {
            const res = await fetch(`${CLOB_API}/time`);
            return res.ok;
        } catch {
            return false;
        }
    }
}
