/**
 * Basic content extractor for URLs.
 * Optimized for Wikipedia, RSS, and generic HTML.
 */
export function extractContent(html: string, url: string): { title: string; content: string; site: string } {
    const isWiki = url.includes('wikipedia.org');

    // 1. Extract Title
    let title = "";
    const titleMatch = html.match(/<title>(.*?)<\/title>/i);
    if (titleMatch) title = titleMatch[1].split(' - ')[0].trim();

    // 2. Extract Site Name
    let site = new URL(url).hostname.replace('www.', '');

    // 3. Simple Body Extraction (strip scripts, styles, nav, footer)
    let body = html
        .replace(/<script\b[^>]*>([\s\S]*?)<\/script>/gim, "")
        .replace(/<style\b[^>]*>([\s\S]*?)<\/style>/gim, "")
        .replace(/<nav\b[^>]*>([\s\S]*?)<\/nav>/gim, "")
        .replace(/<header\b[^>]*>([\s\S]*?)<\/header>/gim, "")
        .replace(/<footer\b[^>]*>([\s\S]*?)<\/footer>/gim, "");

    // 4. Extract Main Text Blocks
    // We look for large tags like <p>, <li>, <article>, <div> with lots of text
    let cleanText = "";

    if (isWiki) {
        // Wikipedia specific: look for mw-parser-output
        const wikiMatch = body.match(/<div[^>]*class="mw-parser-output"[^>]*>([\s\S]*?)<\/div>/i);
        if (wikiMatch) body = wikiMatch[1];
    }

    // Strip remaining tags but keep headings for chunking structure
    cleanText = body
        .replace(/<h[1-6][^>]*>(.*?)<\/h[1-6]>/gim, "\n\n# $1\n")
        .replace(/<p[^>]*>(.*?)<\/p>/gim, "\n$1\n")
        .replace(/<li[^>]*>(.*?)<\/li>/gim, "\n- $1\n")
        .replace(/<[^>]*>/g, " ")
        .replace(/&nbsp;/g, " ")
        .replace(/&quot;/g, '"')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/\n\s*\n/g, "\n\n")
        .trim();

    return { title, content: cleanText, site };
}
