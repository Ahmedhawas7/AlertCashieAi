export interface LiveCoin {
    symbol: string;
    name: string;
    current_price: number;
    price_change_percentage_24h: number;
    high_24h?: number;
    low_24h?: number;
    volume_24h?: number;
}

export interface LiveIntel {
    timestamp: number;
    global?: any;
    topCoins: LiveCoin[];
    trendingBase?: any[];
    polyMarkets?: any[];
    news?: Array<{ title: string; source?: string; pubDate?: string }>;
}

interface KnownCoinDef {
    symbol: string;
    name: string;
    binance: string;
    geckoId: string;
    regex: RegExp;
}

const KNOWN_COINS: KnownCoinDef[] = [
    { symbol: 'btc', name: 'بتكوين (Bitcoin)', binance: 'BTCUSDT', geckoId: 'bitcoin', regex: /بيتكوين|بتكوين|bitcoin|btc/i },
    { symbol: 'eth', name: 'إيثيريوم (Ethereum)', binance: 'ETHUSDT', geckoId: 'ethereum', regex: /إيثيريوم|ايثيريوم|اثيريوم|ethereum|eth/i },
    { symbol: 'sol', name: 'سولانا (Solana)', binance: 'SOLUSDT', geckoId: 'solana', regex: /سولانا|solana|sol/i },
    { symbol: 'bnb', name: 'بينانس (BNB)', binance: 'BNBUSDT', geckoId: 'binancecoin', regex: /بينانس|bnb/i },
    { symbol: 'xrp', name: 'ريبل (XRP)', binance: 'XRPUSDT', geckoId: 'ripple', regex: /ريبل|xrp|ripple/i },
    { symbol: 'doge', name: 'دوجكوين (Dogecoin)', binance: 'DOGEUSDT', geckoId: 'dogecoin', regex: /دوج|doge|dogecoin/i },
    { symbol: 'pepe', name: 'بيبي (PEPE)', binance: 'PEPEUSDT', geckoId: 'pepe', regex: /بيبي|pepe/i },
    { symbol: 'shib', name: 'شيبا (SHIB)', binance: 'SHIBUSDT', geckoId: 'shiba-inu', regex: /شيبا|shib/i },
    { symbol: 'ton', name: 'تون كوين (TON)', binance: 'TONUSDT', geckoId: 'the-open-network', regex: /تون|ton|toncoin/i },
    { symbol: 'sui', name: 'سوي (SUI)', binance: 'SUIUSDT', geckoId: 'sui', regex: /سوي|sui/i },
    { symbol: 'ada', name: 'كاردانو (Cardano)', binance: 'ADAUSDT', geckoId: 'cardano', regex: /كاردانو|ada|cardano/i },
    { symbol: 'avax', name: 'أفالانش (AVAX)', binance: 'AVAXUSDT', geckoId: 'avalanche-2', regex: /افالانش|افاكس|avax/i }
];

export class LiveNews {
    private static CACHE: { data: LiveIntel; expires: number } | null = null;
    private static CACHE_TTL = 3 * 60 * 1000; // 3 minutes cache for fresh live data

    static async fetchLatest(force: boolean = false): Promise<LiveIntel> {
        const now = Date.now();
        if (!force && this.CACHE && this.CACHE.expires > now) {
            return this.CACHE.data;
        }

        try {
            const [topCoins, global, dexscreener, poly, news] = await Promise.all([
                this.fetchBinanceTopCoins(),
                this.fetchCoinGeckoGlobal(),
                this.fetchDexScreenerBase(),
                this.fetchPolymarket(),
                this.fetchCryptoNews()
            ]);

            const intel: LiveIntel = {
                timestamp: now,
                global: global || {
                    total_market_cap: { usd: 2.75e12 },
                    market_cap_percentage: { btc: 56.4 }
                },
                topCoins: topCoins.length > 0 ? topCoins : await this.fetchCoinGeckoMarkets(),
                trendingBase: dexscreener || [],
                polyMarkets: poly || [],
                news: news || []
            };

            this.CACHE = { data: intel, expires: now + this.CACHE_TTL };
            return intel;
        } catch (e) {
            console.error('Failed to fetch live intel:', e);
            if (this.CACHE?.data) return this.CACHE.data;

            return {
                timestamp: now,
                topCoins: [
                    { symbol: 'btc', name: 'بتكوين (BTC)', current_price: 80900, price_change_percentage_24h: -2.8 },
                    { symbol: 'eth', name: 'إيثيريوم (ETH)', current_price: 2360, price_change_percentage_24h: -5.4 },
                    { symbol: 'sol', name: 'سولانا (SOL)', current_price: 102.2, price_change_percentage_24h: -4.1 }
                ],
                news: [
                    { title: 'تحركات في سوق العملات الرقمية مع ضغوط بيعية على العملات الكبرى' }
                ]
            };
        }
    }

    /**
     * Intelligently detect any and all coins mentioned in a user prompt or text,
     * and fetch their real-time prices with multi-source fallback (Binance -> CoinGecko -> Coinbase).
     */
    static async fetchCoinsFromText(text: string): Promise<LiveCoin[]> {
        const detected = KNOWN_COINS.filter(c => c.regex.test(text));

        // If nothing matched, but user typed something short like "NEAR" or "LINK"
        if (detected.length === 0) {
            const cleanWord = text.trim().replace(/[^a-zA-Z0-9]/g, '').toUpperCase().replace(/USDT$|USD$/, '');
            if (cleanWord && cleanWord.length >= 2 && cleanWord.length <= 8) {
                detected.push({
                    symbol: cleanWord.toLowerCase(),
                    name: cleanWord,
                    binance: `${cleanWord}USDT`,
                    geckoId: cleanWord.toLowerCase(),
                    regex: new RegExp(cleanWord, 'i')
                });
            } else {
                // Default fallback to BTC
                detected.push(KNOWN_COINS[0]);
            }
        }

        const results: LiveCoin[] = [];
        for (const coin of detected) {
            const live = await this.fetchSingleCoin(coin);
            if (live) results.push(live);
        }

        return results;
    }

    /**
     * Single coin live price lookup
     */
    private static async fetchSingleCoin(coin: KnownCoinDef): Promise<LiveCoin | null> {
        // Source 1: Binance 24hr Ticker
        try {
            const res = await fetch(`https://api.binance.com/api/v3/ticker/24hr?symbol=${coin.binance}`, {
                headers: { 'User-Agent': 'Mozilla/5.0' }
            });
            if (res.ok) {
                const d: any = await res.json();
                return {
                    symbol: coin.symbol,
                    name: coin.name,
                    current_price: parseFloat(d.lastPrice),
                    price_change_percentage_24h: parseFloat(d.priceChangePercent),
                    high_24h: parseFloat(d.highPrice),
                    low_24h: parseFloat(d.lowPrice),
                    volume_24h: parseFloat(d.quoteVolume)
                };
            }
        } catch { }

        // Source 2: CoinGecko Simple Price
        try {
            const res = await fetch(
                `https://api.coingecko.com/api/v3/simple/price?ids=${coin.geckoId}&vs_currencies=usd&include_24hr_change=true`,
                { headers: { 'User-Agent': 'Mozilla/5.0' } }
            );
            if (res.ok) {
                const d: any = await res.json();
                const data = d[coin.geckoId];
                if (data?.usd) {
                    return {
                        symbol: coin.symbol,
                        name: coin.name,
                        current_price: data.usd,
                        price_change_percentage_24h: data.usd_24h_change || 0
                    };
                }
            }
        } catch { }

        // Source 3: Coinbase Spot
        try {
            const res = await fetch(`https://api.coinbase.com/v2/prices/${coin.symbol.toUpperCase()}-USD/spot`);
            if (res.ok) {
                const d: any = await res.json();
                const amt = parseFloat(d.data?.amount);
                if (amt) {
                    return {
                        symbol: coin.symbol,
                        name: coin.name,
                        current_price: amt,
                        price_change_percentage_24h: 0
                    };
                }
            }
        } catch { }

        return null;
    }

    private static async fetchBinanceTopCoins(): Promise<LiveCoin[]> {
        try {
            const symbols = JSON.stringify(["BTCUSDT", "ETHUSDT", "SOLUSDT", "BNBUSDT", "XRPUSDT"]);
            const res = await fetch(`https://api.binance.com/api/v3/ticker/24hr?symbols=${encodeURIComponent(symbols)}`);
            if (!res.ok) return [];

            const data: any[] = await res.json();
            const symbolMap: Record<string, { symbol: string; name: string }> = {
                'BTCUSDT': { symbol: 'btc', name: 'بتكوين (BTC)' },
                'ETHUSDT': { symbol: 'eth', name: 'إيثيريوم (ETH)' },
                'SOLUSDT': { symbol: 'sol', name: 'سولانا (SOL)' },
                'BNBUSDT': { symbol: 'bnb', name: 'بينانس (BNB)' },
                'XRPUSDT': { symbol: 'xrp', name: 'ريبل (XRP)' }
            };

            return data.map(item => {
                const meta = symbolMap[item.symbol] || { symbol: item.symbol.toLowerCase(), name: item.symbol };
                return {
                    symbol: meta.symbol,
                    name: meta.name,
                    current_price: parseFloat(item.lastPrice),
                    price_change_percentage_24h: parseFloat(item.priceChangePercent),
                    high_24h: parseFloat(item.highPrice),
                    low_24h: parseFloat(item.lowPrice),
                    volume_24h: parseFloat(item.quoteVolume)
                };
            });
        } catch {
            return [];
        }
    }

    private static async fetchCoinGeckoMarkets(): Promise<LiveCoin[]> {
        try {
            const res = await fetch('https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=5&page=1', {
                headers: { 'Accept': 'application/json', 'User-Agent': 'Mozilla/5.0' }
            });
            if (!res.ok) return [];
            const data: any[] = await res.json();
            return data.map(c => ({
                symbol: c.symbol.toLowerCase(),
                name: c.name,
                current_price: c.current_price,
                price_change_percentage_24h: c.price_change_percentage_24h || 0
            }));
        } catch {
            return [];
        }
    }

    private static async fetchCoinGeckoGlobal() {
        try {
            const res = await fetch('https://api.coingecko.com/api/v3/global', {
                headers: { 'Accept': 'application/json', 'User-Agent': 'Mozilla/5.0' }
            });
            if (!res.ok) return null;
            const data: any = await res.json();
            return data.data;
        } catch { return null; }
    }

    private static async fetchDexScreenerBase() {
        try {
            const res = await fetch('https://api.dexscreener.com/latest/dex/search?q=base', {
                headers: { 'Accept': 'application/json' }
            });
            if (!res.ok) return null;
            const data: any = await res.json();
            return data.pairs ? data.pairs.slice(0, 5) : null;
        } catch { return null; }
    }

    private static async fetchPolymarket() {
        try {
            const res = await fetch('https://gamma-api.polymarket.com/markets?active=true&closed=false&limit=5&sort=volume24hr:desc', {
                headers: { 'Accept': 'application/json' }
            });
            if (!res.ok) return null;
            return await res.json();
        } catch { return null; }
    }

    private static async fetchCryptoNews(): Promise<Array<{ title: string; source?: string; pubDate?: string }>> {
        try {
            const url = 'https://news.google.com/rss/search?q=crypto+bitcoin+ethereum&hl=ar&gl=EG&ceid=EG:ar';
            const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
            if (!res.ok) return [];

            const xml = await res.text();
            const items = [...xml.matchAll(/<item>[\s\S]*?<title>(.*?)<\/title>[\s\S]*?<pubDate>(.*?)<\/pubDate>[\s\S]*?<\/item>/g)];

            const list: Array<{ title: string; source?: string; pubDate?: string }> = [];
            for (const item of items.slice(0, 5)) {
                const title = item[1].replace(/<!\[CDATA\[(.*?)\]\]>/g, '$1').trim();
                const pubDate = item[2] || '';
                if (title && !title.toLowerCase().includes('google news')) {
                    list.push({ title, pubDate });
                }
            }

            return list;
        } catch {
            return [];
        }
    }
}
