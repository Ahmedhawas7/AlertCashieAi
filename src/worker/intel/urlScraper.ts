export interface ScrapedPage {
    title: string;
    text: string;
    url: string;
}

export class UrlScraper {
    /**
     * Scrape any web page and extract clean text content
     */
    static async scrape(rawUrl: string): Promise<ScrapedPage | null> {
        try {
            let targetUrl = rawUrl.trim();
            if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
                targetUrl = `https://${targetUrl}`;
            }

            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 8000);

            const res = await fetch(targetUrl, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
                },
                signal: controller.signal
            });

            clearTimeout(timeout);
            if (!res.ok) return null;

            const html = await res.text();

            // Extract title
            const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
            const title = titleMatch ? titleMatch[1].replace(/[\r\n\t]/g, ' ').trim() : 'بدون عنوان';

            // Strip scripts, styles, noscripts, iframes
            let cleaned = html
                .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ' ')
                .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, ' ')
                .replace(/<noscript\b[^<]*(?:(?!<\/noscript>)<[^<]*)*<\/noscript>/gi, ' ')
                .replace(/<nav\b[^<]*(?:(?!<\/nav>)<[^<]*)*<\/nav>/gi, ' ')
                .replace(/<footer\b[^<]*(?:(?!<\/footer>)<[^<]*)*<\/footer>/gi, ' ')
                .replace(/<header\b[^<]*(?:(?!<\/header>)<[^<]*)*<\/header>/gi, ' ')
                .replace(/<[^>]+>/g, ' ')
                .replace(/&nbsp;/g, ' ')
                .replace(/&amp;/g, '&')
                .replace(/&quot;/g, '"')
                .replace(/\s+/g, ' ')
                .trim();

            // Limit to most relevant 3,000 characters
            if (cleaned.length > 3000) {
                cleaned = cleaned.substring(0, 3000) + '...';
            }

            return {
                title,
                text: cleaned,
                url: targetUrl
            };
        } catch (e: any) {
            console.warn(`UrlScraper failed for ${rawUrl}:`, e.message);
            return null;
        }
    }
}
