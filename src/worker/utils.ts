/**
 * Agent Utilities for Arabic Normalization, Egyptian Dialect, and Similarity
 */

/**
 * Normalize Arabic text for better matching
 */
export function normalizeArabic(text: string): string {
    if (!text) return "";
    return text
        .replace(/[\u064B-\u0652]/g, "") // Remove harakat
        .replace(/[أإآ]/g, "ا")
        .replace(/ة/g, "ه")
        .replace(/ى/g, "ي")
        .replace(/[؟?.,!|]/g, " ") // Strip common punctuation
        .toLowerCase()
        .replace(/\s+/g, " ") // Normalize whitespace
        .trim();
}

/**
 * Jaccard Similarity on tokens
 */
export function calculateSimilarity(a: string, b: string): number {
    const tokensA = new Set(normalizeArabic(a).split(/\s+/).filter(t => t.length > 2));
    const tokensB = new Set(normalizeArabic(b).split(/\s+/).filter(t => t.length > 2));

    if (tokensA.size === 0 || tokensB.size === 0) return 0;

    const intersection = new Set([...tokensA].filter(x => tokensB.has(x)));
    const union = new Set([...tokensA, ...tokensB]);

    return intersection.size / union.size;
}

/**
 * Phrase Bank for Egyptian variants (Openings and Closings)
 */
const openings = [
    "بص يا {name}،",
    "بص يا غالي،",
    "زي ما قولتلك،",
    "تمام يا ريس،",
    "عشان تبقى عارف،",
    "خليني أفهمك،",
    "بص بقى،",
    "يا وحش، ركز في دي،",
    "بص يا صديقي،",
    "أهو يا سيدي:"
];

const closings = [
    "تحب نغير حاجة؟",
    "محتاج مني حاجة تانية؟",
    "تمام كده؟",
    "قولي لو في حاجة تانية.",
    "أنا معاك لو احتاجت حاجة.",
    "ماشي يا بطل؟",
    "واضحة؟",
    "منور الدنيا والله.",
    "قولي لو في دماغك حاجة تانية.",
    "تحت أمرك يا غالي."
];

/**
 * Rewrite text with Egyptian flavor and avoid repetition
 */
export function rewriteWithVariants(text: string, name: string, recentReplies: string[] = []): string {
    // Choose opening/closing that wasn't in any of the recent replies
    const availableOpenings = openings.filter(o => {
        const op = o.replace("{name}", name);
        return !recentReplies.some(r => r.includes(op));
    });

    const availableClosings = closings.filter(c => !recentReplies.some(r => r.includes(c)));

    const finalOpenings = availableOpenings.length > 0 ? availableOpenings : openings;
    const finalClosings = availableClosings.length > 0 ? availableClosings : closings;

    const opening = finalOpenings[Math.floor(Math.random() * finalOpenings.length)].replace("{name}", name);
    const closing = finalClosings[Math.floor(Math.random() * finalClosings.length)];

    return `${opening} ${text} ${closing}`;
}

/**
 * Score memory relevance
 */
export function scoreMemory(query: string, key: string, value: string): number {
    const normalizedQuery = normalizeArabic(query);
    const words = normalizedQuery.split(/\s+/).filter(w => w.length >= 2);

    let score = 0;
    const identityWords = ["انا", "اسمي", "مين", "هويتي"];

    for (const word of words) {
        const normKey = normalizeArabic(key);
        const normVal = normalizeArabic(value);
        if (normKey.includes(word)) score += 5;
        if (normVal.includes(word)) score += 2;

        // Exact match bonus
        if (normKey === word) score += 10;

        // Identity bonus
        if (identityWords.includes(word) && (normKey.includes("اسم") || normKey.includes("هويه"))) {
            score += 15;
        }
    }
    return score;
}
