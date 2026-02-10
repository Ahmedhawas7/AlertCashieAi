/**
 * Normalization Utility for Hawas Brain v1
 * Provides consistent tokenization and cleaning for Arabic/English text.
 */

export function normalizeText(text: string): string {
    if (!text) return "";
    return text
        .toLowerCase()
        .replace(/[\u064B-\u0652]/g, "") // Remove Arabic harakat/tashkeel
        .replace(/[أإآ]/g, "ا")
        .replace(/ة/g, "ه")
        .replace(/ى/g, "ي")
        .replace(/[؟?.,!|:;-]/g, " ") // Strip punctuation
        .replace(/\s+/g, " ")       // Normalize whitespace
        .trim();
}

/**
 * Tokenize string into meaningful keywords (min 2 chars)
 */
export function tokenize(text: string): string[] {
    const normalized = normalizeText(text);
    return normalized.split(" ").filter(t => t.length >= 2);
}

/**
 * Get unique tokens for indexing
 */
export function uniqueTokens(text: string): Set<string> {
    return new Set(tokenize(text));
}
