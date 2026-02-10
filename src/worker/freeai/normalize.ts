/**
 * Simple text normalization for BM25 search and indexing.
 * Handles Arabic/English cleanup.
 */
export function normalizeText(text: string): string {
    if (!text) return "";

    return text
        .toLowerCase()
        // Remove diacritics (Arabic)
        .replace(/[\u064B-\u0652]/g, "")
        // Alif normalization
        .replace(/[\u0622\u0623\u0625]/g, "\u0627")
        // Teh Marbuta normalization
        .replace(/\u0629/g, "\u0647")
        // Ya normalization
        .replace(/\u0649/g, "\u064A")
        // Remove non-alphanumeric (keep basic punctuation for sentence splitting later)
        .replace(/[^\u0621-\u064A\u0660-\u0669a-z0-9\s]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

/**
 * Tokenize string into space-separated terms
 */
export function tokenize(text: string): string[] {
    return normalizeText(text).split(" ").filter(t => t.length > 1);
}

/**
 * Basic sentence splitter (naive)
 */
export function splitSentences(text: string): string[] {
    if (!text) return [];
    // Split by common sentence delimiters
    return text.split(/[.!?\n\r]+/)
        .map(s => s.trim())
        .filter(s => s.length > 5);
}
