import { Citation, FreeAiResult } from './types';

export function composeAnswer(query: string, citations: Citation[]): FreeAiResult {
    if (citations.length === 0) {
        return {
            answer: "يا ريس للأسف مش لاقي معلومة مؤكدة عن الموضوع ده في اللي قرأته قبل كدة. جرب تبعتلي رابط أقرأه أو وضح السؤال شوية.",
            citations: [],
            confidence: 0
        };
    }

    // Compose answer in Egyptian Arabic
    let answer = `بناءً على اللي عرفته يا ريس:\n\n`;

    // Simple logic: combine excerpts or synthesize highlights
    const highlights = citations.map((c, i) => `• ${c.excerpt} [${i + 1}]`).join("\n");

    answer += highlights;
    answer += `\n\nأقدر أقولك إن الخلاصة هي إن الموضوع مرتبط بـ ${citations[0].title}.`;

    return {
        answer,
        citations,
        confidence: 0.8
    };
}

export function formatCitations(citations: Citation[]): string {
    if (citations.length === 0) return "";

    let text = `\n\n📚 **المصادر:**\n`;
    citations.forEach((c, i) => {
        text += `[${i + 1}] ${c.title} \n🔗 ${c.url}\n`;
    });

    return text;
}
