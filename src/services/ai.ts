import { GoogleGenerativeAI } from '@google/generative-ai';
import { StorageService } from './storage';
import fetch from 'node-fetch';

export class AIService {
    private genAI: GoogleGenerativeAI | null = null;
    private storage: StorageService | null = null;

    // Config
    private provider: 'gemini' | 'openai' | 'deepseek' = 'gemini';
    private apiKey: string = '';
    private baseURL: string = '';
    private model: string = '';

    public isAIEnabled: boolean = false;
    public isAutolearnEnabled: boolean = false;

    // Persona
    private persona = `
You are "AlertAi", an Egyptian AI partner (Super Agent).
Language: Egyptian Arabic (Masri).
Tone: Helpful, direct, smart ("يا زميلي").
Role: Protect user, find opportunities, execute skills.

CRITICAL:
- Use tools when asked.
- Answer formatted in Markdown.
- NEVER ask for private keys.
`;

    constructor(apiKey?: string, storage?: StorageService) {
        this.apiKey = apiKey || '';
        if (storage) this.storage = storage;

        // Load Env Config
        this.provider = (process.env.LLM_PROVIDER as any) || 'gemini';
        this.baseURL = process.env.LLM_BASE_URL || 'https://api.openai.com/v1';
        this.model = process.env.LLM_MODEL || 'gpt-3.5-turbo';

        if (this.provider === 'gemini' && this.apiKey) {
            this.genAI = new GoogleGenerativeAI(this.apiKey);
            this.model = 'gemini-1.5-flash';
        }
    }

    async init() {
        if (this.storage) {
            this.isAIEnabled = await this.storage.getConfig('ai_enabled') === 'true';
            this.isAutolearnEnabled = await this.storage.getConfig('autolearn_enabled') === 'true';
            console.log(`🧠 AI Service Initialized: Provider=${this.provider}, AI=${this.isAIEnabled}`);
        }
    }

    async toggleAI(enabled: boolean) {
        this.isAIEnabled = enabled;
        if (this.storage) await this.storage.setConfig('ai_enabled', enabled.toString());
    }

    async toggleAutolearn(enabled: boolean) {
        this.isAutolearnEnabled = enabled;
        if (this.storage) await this.storage.setConfig('autolearn_enabled', enabled.toString());
    }

    // Generic Chat Completion
    async generate(messages: any[]): Promise<string> {
        if (!this.isAIEnabled) return "🔴 AI is disabled.";

        try {
            if (this.provider === 'gemini') {
                return await this.generateGemini(messages);
            } else {
                return await this.generateOpenAICompatible(messages);
            }
        } catch (error) {
            console.error('AI Generation Error:', error);
            return "معلش، حصلت مشكلة في الاتصال بالمخ (AI Error).";
        }
    }

    private async generateGemini(messages: any[]): Promise<string> {
        if (!this.genAI) throw new Error("Gemini API Key missing");

        const model = this.genAI.getGenerativeModel({ model: this.model });

        // Convert messages to prompt (Simplification for Gemini text model)
        // Ideally use startChat
        const history = messages.map(m => `${m.role.toUpperCase()}: ${m.content}`).join('\n');
        const prompt = `${this.persona}\n\n${history}\n\nASSISTANT:`;

        const result = await model.generateContent(prompt);
        return result.response.text();
    }

    private async generateOpenAICompatible(messages: any[]): Promise<string> {
        // Prepend System Prompt if not present
        if (messages.length === 0 || messages[0].role !== 'system') {
            messages.unshift({ role: 'system', content: this.persona });
        }

        const payload = {
            model: this.model,
            messages: messages,
            temperature: 0.7
        };

        const response = await fetch(`${this.baseURL}/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.apiKey}`
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            throw new Error(`API Error: ${response.statusText}`);
        }

        const data: any = await response.json();
        return data.choices[0].message.content;
    }

    // Legacy method for fallback compatibility
    async ask(query: string, context: string, usage: number): Promise<string> {
        return this.generate([
            { role: 'system', content: `Context: ${context}` },
            { role: 'user', content: query }
        ]);
    }
}
