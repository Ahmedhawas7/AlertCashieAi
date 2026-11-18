export interface WebSearchResult {
    source: 'wikipedia' | 'google_news';
    title: string;
    snippet: string;
    url?: string;
}

export class WebSearchService {
    /**
     * Search both Arabic Wikipedia and Google News for any topic or query
     */
    static async search(query: string): Promise<WebSearchResult[]> {
        const results: WebSearchResult[] = [];
        const cleanQuery = query.trim();
        if (!cleanQuery) return results;

        // Run Wikipedia and Google News searches in parallel
        await Promise.allSettled([
            this.searchWikipedia(cleanQuery).then(items => results.push(...items)),
            this.searchGoogleNews(cleanQuery).then(items => results.push(...items))
        ]);

        return results;
    }

    private static async searchWikipedia(query: string): Promise<WebSearchResult[]> {
        try {
            const url = `https://ar.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&utf8=&format=json`;
            const res = await fetch(url, {
                headers: { 'User-Agent': 'HawasAgent/2.0 (Autonomous)' }
            });

            if (!res.ok) return [];
            const data: any = await res.json();
            const hits = data?.query?.search || [];

            return hits.slice(0, 3).map((h: any) => ({
                source: 'wikipedia' as const,
                title: h.title,
                snippet: (h.snippet || '').replace(/<[^>]+>/g, '').trim(),
                url: `https://ar.wikipedia.org/wiki/${encodeURIComponent(h.title)}`
            }));
        } catch {
            return [];
        }
    }

    private static async searchGoogleNews(query: string): Promise<WebSearchResult[]> {
        try {
            const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=ar&gl=EG&ceid=EG:ar`;
            const res = await fetch(url, {
                headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
            });

            if (!res.ok) return [];
            const xml = await res.text();
            const items = [...xml.matchAll(/<item>[\s\S]*?<title>(.*?)<\/title>[\s\S]*?<pubDate>(.*?)<\/pubDate>[\s\S]*?<\/item>/g)];

            const newsResults: WebSearchResult[] = [];
            for (const item of items.slice(0, 4)) {
                const title = item[1].replace(/<!\[CDATA\[(.*?)\]\]>/g, '$1').trim();
                const pubDate = item[2] || '';
                if (title && !title.toLowerCase().includes('google news')) {
                    newsResults.push({
                        source: 'google_news' as const,
                        title,
                        snippet: `تاريخ النشر: ${pubDate}`
                    });
                }
            }
            return newsResults;
        } catch {
            return [];
        }
    }
}
