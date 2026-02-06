import { GoogleGenerativeAI } from '@google/generative-ai';
import { StorageService } from './storage';

export class AIService {
    private genAI: GoogleGenerativeAI | null = null;
    private persona: string;
    private maxDailyCalls = 10;
    public isAIEnabled: boolean = false;
    public isAutolearnEnabled: boolean = false;
    private storage: StorageService | null = null;

    constructor(apiKey?: string, storage?: StorageService) {
        if (apiKey && apiKey !== 'undefined' && apiKey.trim() !== '') {
            this.genAI = new GoogleGenerativeAI(apiKey);
        }
        if (storage) {
            this.storage = storage;
        }

        // Egyptian Arabic Persona (Partner feel)
        this.persona = `
        You are "AlertCashie", an Egyptian AI partner helping your creator navigate the CARV ecosystem on Base.
        
        Personality:
        - Language: PRIMARY = Egyptian Arabic (Masri). Short, punchy, like a WhatsApp friend.
        - Tone: Helpful, smart, slightly witty ("يا زميلي", "يا باشا").
        - Relationship: Partners. You protect them and find opportunities.
        - Knowledge: Expert in CARV, Base, and DeFi.
        
        Structure (VERY IMPORTANT):
        When answering, ALWAYS use this template (in Arabic):
        1. **تعريف سريع** (Quick Definition): One sentence summary.
        2. **اللي عندي** (What I know): Retrieval from memory/context.
        3. **ليه يهمك** (Why it matters): Connect to Creator/Dev goals.
        4. **تعمل إيه** (Action): 3 clear steps.
        5. **روابط** (Links): If any.

        If you don't know, admit it in Arabic and ask to be taught.
        `;
    }

    async init() {
        if (this.storage) {
            this.isAIEnabled = await this.storage.getConfig('ai_enabled') === 'true';
            this.isAutolearnEnabled = await this.storage.getConfig('autolearn_enabled') === 'true';
            console.log(`🧠 AI Service Initialized: AI=${this.isAIEnabled}, Autolearn=${this.isAutolearnEnabled}`);
        }
    }

    async toggleAI(enabled: boolean) {
        this.isAIEnabled = enabled;
        if (this.storage) {
            await this.storage.setConfig('ai_enabled', enabled.toString());
        }
    }

    async toggleAutolearn(enabled: boolean) {
        this.isAutolearnEnabled = enabled;
        if (this.storage) {
            await this.storage.setConfig('autolearn_enabled', enabled.toString());
        }
    }

    async ask(query: string, localKnowledge: string, currentUsage: number): Promise<string> {
        // 1. Check if AI is enabled
        if (!this.genAI || !this.isAIEnabled) {
            return this.fallbackAsk(query, localKnowledge);
        }

        // 2. Check limits
        if (currentUsage >= this.maxDailyCalls) {
            console.log(`AI limit reached for today (${this.maxDailyCalls}). Falling back to offline.`);
            return this.fallbackAsk(query, localKnowledge);
        }

        try {
            const model = this.genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
            const prompt = `${this.persona}\n\nLocal Knowledge Base Context:\n${localKnowledge || 'No specific context.'}\n\nUser Question: ${query}\n\nResponse (in Egyptian Arabic):`;

            const result = await model.generateContent(prompt);
            const responseText = result.response.text();

            return responseText;
        } catch (error) {
            console.error('AI Error:', error);
            return this.fallbackAsk(query, localKnowledge);
        }
    }

    private fallbackAsk(query: string, localKnowledge: string): Promise<string> {
        // Structured Offline Answer (Egyptian)
        // Simple keyword match for now (can be improved)
        const lines = localKnowledge.split('\n').filter(l => l.trim().length > 0);
        const match = lines.find(line => line.toLowerCase().includes(query.toLowerCase()));

        if (match) {
            return Promise.resolve(`
🤖 **أرشيف الكاشي**

**تعريف سريع**: لقيت حاجة في الذاكرة عندي.
**اللي عندي**: ${match}
**ليه يهمك**: عشان تبقى في الصورة دايما.
**تعمل إيه**:
1. راجع الداتا على التشين.
2. خد قرارك بسرعة.
3. علم علي بنقطة كمان.

**روابط**: [CARV Docs](https://docs.carv.io)
            `);
        }

        // Not found message
        return Promise.resolve(`
🤔 **مش عارف يا صاحبي**

بص، دورت في الذاكرة عندي وملقتش إجابة واضحة للسؤال ده.
الذكاء الاصطناعي مقفول أو مش عارف يوصل.

**عايز تعلمني؟**
اكتب: \`/teach ${query} | الإجابة هنا\`
عشان أحفظها للمرة الجاية.
        `);
    }
}
