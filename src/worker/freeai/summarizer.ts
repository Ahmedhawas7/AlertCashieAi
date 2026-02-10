import { splitSentences, tokenize } from './normalize';

export function summarize(text: string): { tldr: string; bullets: string[]; facts: string[] } {
    const sentences = splitSentences(text);
    if (sentences.length === 0) return { tldr: "مفيش محتوى كافي.", bullets: [], facts: [] };

    // 1. Simple sentence scoring based on word frequency
    const wordCounts: Record<string, number> = {};
    const words = tokenize(text);
    words.forEach(w => {
        if (w.length > 3) wordCounts[w] = (wordCounts[w] || 0) + 1;
    });

    const scoredSentences = sentences.map(s => {
        const sWords = tokenize(s);
        let score = 0;
        sWords.forEach(w => score += (wordCounts[w] || 0));
        // Normalize by length to avoid just picking longest sentence
        return { text: s, score: score / (sWords.length + 1) };
    });

    // Sort by score
    const sorted = scoredSentences.sort((a, b) => b.score - a.score);

    // 2. Compose TLDR (top 2 sentences that appear early in text often contain key info)
    const tldr = sorted.slice(0, 2).map(s => s.text).join(". ") + ".";

    // 3. Bullets (top 5-8 unique facts/info)
    const bullets = sorted.slice(2, 10).map(s => s.text);

    // 4. Basic Fact Extraction (look for numbers, dates, addresses)
    const facts = sentences.filter(s =>
        /\b\d{1,}\b/.test(s) || // Contains numbers
        /0x[a-fA-F0-9]{40}/.test(s) || // Contains ETH address
        /يناير|فبراير|مارس|أبريل|مايو|يونيو|يوليو|أغسطس|سبتمبر|أكتوبر|نوفمبر|ديسمبر/.test(s) // Contains Arabic months
    ).slice(0, 5);

    return { tldr, bullets, facts };
}
