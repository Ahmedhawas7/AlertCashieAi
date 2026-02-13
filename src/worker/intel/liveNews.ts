export interface LiveIntel {
    timestamp: number;
    global?: any;
    topCoins?: any[];
    trendingBase?: any[];
    polyMarkets?: any[];
    news?: any[];
}

export class LiveNews {
    private static CACHE: { data: LiveIntel; expires: number } | null = null;
    private static CACHE_TTL = 10 * 60 * 1000; // 10 minutes for "real-time"

    static async fetchLatest(force: boolean = false): Promise<LiveIntel | null> {
        const now = Date.now();
        if (!force && this.CACHE && this.CACHE.expires > now) {
            return this.CACHE.data;
        }

        try {
            const [global, markets, dexscreener, poly, news] = await Promise.all([
                this.fetchCoinGeckoGlobal(),
                this.fetchCoinGeckoMarkets(),
                this.fetchDexScreenerBase(),
                this.fetchPolymarket(),
                this.fetchCryptoPanic()
            ]);

            const intel: LiveIntel = {
                timestamp: now,
                global,
                topCoins: markets,
                trendingBase: dexscreener,
                polyMarkets: poly,
                news
            };

            this.CACHE = { data: intel, expires: now + this.CACHE_TTL };
            return intel;
        } catch (e) {
            console.error('Failed to fetch live intel:', e);
            return this.CACHE?.data || null;
        }
    }

    private static async fetchCoinGeckoGlobal() {
        try {
            const res = await fetch('https://api.coingecko.com/api/v3/global', {
                headers: { 'Accept': 'application/json' }
            });
            const data: any = await res.json();
            return data.data;
        } catch { return null; }
    }

    private static async fetchCoinGeckoMarkets() {
        try {
            const res = await fetch('https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=5&page=1', {
                headers: { 'Accept': 'application/json' }
            });
            return await res.json();
        } catch { return null; }
    }

    private static async fetchDexScreenerBase() {
        try {
            const res = await fetch('https://api.dexscreener.com/latest/dex/search?q=base', {
                headers: { 'Accept': 'application/json' }
            });
            const data: any = await res.json();
            return data.pairs ? data.pairs.slice(0, 5) : null;
        } catch { return null; }
    }

    private static async fetchPolymarket() {
        try {
            // Gamma API for Polymarket
            const res = await fetch('https://gamma-api.polymarket.com/markets?active=true&closed=false&limit=5&sort=volume24hr:desc', {
                headers: { 'Accept': 'application/json' }
            });
            return await res.json();
        } catch { return null; }
    }

    private static async fetchCryptoPanic() {
        try {
            // Free public endpoint might be restricted, but let's try
            const res = await fetch('https://cryptopanic.com/api/free/v1/posts/', {
                headers: { 'Accept': 'application/json' }
            });
            const data: any = await res.json();
            return data.results ? data.results.slice(0, 5) : null;
        } catch { return null; }
    }
}
