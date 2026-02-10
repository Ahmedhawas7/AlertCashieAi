export function extractEntities(text: string): { tickers: string[]; addresses: string[]; dates: string[] } {
    const tickers = Array.from(text.matchAll(/\$[A-Z]{2,10}/g)).map(m => m[0]);
    const addresses = Array.from(text.matchAll(/0x[a-fA-F0-9]{40}/g)).map(m => m[0]);

    // Naive date matching
    const datePattern = /\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}/g;
    const dates = Array.from(text.matchAll(datePattern)).map(m => m[0]);

    return {
        tickers: [...new Set(tickers)],
        addresses: [...new Set(addresses)],
        dates: [...new Set(dates)]
    };
}
