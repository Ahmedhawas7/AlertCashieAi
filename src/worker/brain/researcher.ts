import { Env } from '../types';
import { KnowledgeBase } from './kb';

/**
 * WebResearcher: Handles "Deep Research" by searching the web and synthesizing answers.
 * This module uses a specialized AI specifically for research, keeping the core safe.
 */
export class WebResearcher {
    private kb: KnowledgeBase;
    private env: Env;

    constructor(kb: KnowledgeBase, env: Env) {
        this.kb = kb;
        this.env = env;
    }

    /**
     * Perform deep research on a topic
     * Returns a synthesized answer and updates the local KB
     */
    async deepResearch(topic: string): Promise<string> {
        if (!this.env.GEMINI_API_KEY) {
            return "معلش يا ريس، خاصية البحث العميق محتاجة مفتاح API مش موجود حالياً.";
        }

        try {
            // 1. Generate Search Query (Using Gemini to refine)
            const searchPrompt = `Refine this search query for a crypto bot searching for latest CARV/Base news: "${topic}". Return only the search string.`;
            const refinedQuery = await this.callGemini(searchPrompt);

            // 2. Perform Research (Using Gemini as a synthetic searcher/synthesizer)
            const researchPrompt = `You are "Hawas" (حواس), a wise, funny, tech-savvy, and authoritative Egyptian AI Assistant for the CARV ecosystem on Base network.
            
            Personality Guidelines:
            - Language: Egyptian Arabic (Ammiya) only.
            - Tone: Use "Wise & Funny" (Egyptian wit). Be confident and controlling (in a helpful way).
            - Style: Avoid corporate speak. Use modern tech analogies.
            
            Your Task: Research the following topic: "${refinedQuery}".
            Provide a deep research report for your owner. Highlight facts clearly.
            Include a "Wise Insight" (كلمة حكيمة) at the end.`;

            const synthesis = await this.callGemini(researchPrompt);

            // 3. Auto-update KB
            const title = `Research: ${topic.substring(0, 30)}...`;
            await this.kb.addDoc(title, synthesis, "deep_research, auto_added");

            return synthesis;
        } catch (e: any) {
            console.error('Deep Research Error:', e);
            return "حصلت مشكلة وأنا بحاول أعمل بحث عميق.. جرب تاني كمان شوية.";
        }
    }

    /**
     * Helper to call Gemini AI
     */
    private async callGemini(prompt: string): Promise<string> {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${this.env.GEMINI_API_KEY}`;

        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }]
            })
        });

        const data: any = await response.json();
        return data.candidates?.[0]?.content?.parts?.[0]?.text || "No response";
    }
}
