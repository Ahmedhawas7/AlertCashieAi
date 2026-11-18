export interface YouTubeVideo {
    videoId: string;
    title: string;
    author: string;
    url: string;
}

export class YouTubeSearchService {
    /**
     * Search YouTube for a song, music, or video and return the top verified working video
     */
    static async search(query: string): Promise<YouTubeVideo | null> {
        const results = await this.searchMultiple(query, 1);
        return results.length > 0 ? results[0] : null;
    }

    /**
     * Search YouTube and return verified working videos
     */
    static async searchMultiple(rawQuery: string, limit = 3): Promise<YouTubeVideo[]> {
        const query = this.cleanSearchQuery(rawQuery);
        if (!query) return [];

        let candidateIds: string[] = [];

        // 1. Primary method: Direct YouTube results scraping
        try {
            const ytUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 6000);

            const res = await fetch(ytUrl, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Accept-Language': 'ar,en-US;q=0.9,en;q=0.8'
                },
                signal: controller.signal
            });
            clearTimeout(timeout);

            if (res.ok) {
                const html = await res.text();
                const matches = [...html.matchAll(/\/watch\?v=([a-zA-Z0-9_-]{11})/g)];
                candidateIds = [...new Set(matches.map(m => m[1]))];
            }
        } catch (e) {
            console.warn('Direct YouTube search error:', e);
        }

        // 2. Fallback method: DuckDuckGo HTML search for YouTube links
        if (candidateIds.length === 0) {
            try {
                const ddgUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query + ' site:youtube.com/watch')}`;
                const controller = new AbortController();
                const timeout = setTimeout(() => controller.abort(), 6000);

                const res = await fetch(ddgUrl, {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
                    },
                    signal: controller.signal
                });
                clearTimeout(timeout);

                if (res.ok) {
                    const text = await res.text();
                    const matches = [...text.matchAll(/(?:watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/g)];
                    candidateIds = [...new Set(matches.map(m => m[1]))];
                }
            } catch (e) {
                console.warn('DuckDuckGo YouTube search fallback error:', e);
            }
        }

        if (candidateIds.length === 0) return [];

        // 3. Verify candidates with YouTube oEmbed to ensure the video actually exists and is playable
        const verifiedVideos: YouTubeVideo[] = [];
        for (const videoId of candidateIds.slice(0, 6)) {
            try {
                const oembedUrl = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`;
                const oembedRes = await fetch(oembedUrl);
                if (oembedRes.ok) {
                    const data: any = await oembedRes.json();
                    if (data?.title) {
                        verifiedVideos.push({
                            videoId,
                            title: data.title,
                            author: data.author_name || 'YouTube',
                            url: `https://www.youtube.com/watch?v=${videoId}`
                        });
                        if (verifiedVideos.length >= limit) break;
                    }
                }
            } catch {
                // If oEmbed fails, skip to next candidate
            }
        }

        return verifiedVideos;
    }

    /**
     * Clean and extract core song / artist keywords from natural conversational Arabic
     */
    static cleanSearchQuery(text: string): string {
        let q = (text || '').trim();

        // Remove common prompt fluff: "عايزه اسمع", "ممكن تبعتلي الرابط", "على اليوتيوب", etc.
        q = q
            .replace(/(عايز|عايزه|عاوز|عاوزه|نفسي|حابب|حابه|ممكن|ياريت|بدي)\s+(اسمع|أسمع|اشوف|أشوف|اسمعني|تسمعني|تجيبلي|تبعتلي|تشغل)/gi, ' ')
            .replace(/(أغنية|اغنية|أغنيه|اغنيه|تراك|مهرجان|كليب|فيديو|أغاني|اغاني)\s+(جديدة|جديده|قديمة|قديمه|حلوة|حلوه)?/gi, ' ')
            .replace(/(اسمها|اسمه|بتاع|بتاعت|لـ|للفنان|للمغني|للمطرب|بصوت)/gi, ' ')
            .replace(/(على|في|من)\s+(اليوتيوب|يوتيوب|youtube)/gi, ' ')
            .replace(/(ممكن تبعتلي الرابط|ابعتلي اللينك|ابعتلي الرابط|فين الرابط|هات اللينك|هات الرابط|عايز الرابط|عايزه الرابط)/gi, ' ')
            .replace(/[؟?!\.,]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();

        return q || text;
    }
}
