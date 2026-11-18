import { Env } from '../../types';

export interface GeminiResult {
    text: string;
    provider: string;
    model: string;
    latencyMs: number;
    status: number;
    error?: string;
}

export class GeminiProvider {
    private env: Env;
    private apiKey: string;

    constructor(env: Env) {
        this.env = env;
        this.apiKey = env.GEMINI_API_KEY || '';
    }

    async chat(
        messages: Array<{ role: string; content: string }>,
        options?: {
            temperature?: number;
            maxTokens?: number;
        }
    ): Promise<GeminiResult> {
        if (!this.apiKey) {
            return {
                text: '',
                provider: 'Gemini',
                model: 'none',
                latencyMs: 0,
                status: 401,
                error: 'GEMINI_API_KEY missing'
            };
        }

        const candidates = [
            this.env.GEMINI_MODEL || 'gemini-3.1-flash-lite',
            'gemini-3.5-flash-lite',
            'gemini-flash-lite-latest',
            'gemini-3.8-flash'
        ];

        let lastError = '';
        let lastStatus = 500;

        for (const model of candidates) {
            const start = Date.now();
            const timeout = parseInt(this.env.AI_TIMEOUT_MS || '15000');
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), timeout);

            try {
                // Convert messages to Gemini format
                const contents = messages.map(m => ({
                    role: m.role === 'assistant' ? 'model' : 'user',
                    parts: [{ text: m.content }]
                }));

                const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${this.apiKey}`;

                const response = await fetch(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents,
                        generationConfig: {
                            temperature: options?.temperature ?? 0.7,
                            maxOutputTokens: options?.maxTokens ?? 1000,
                        }
                    }),
                    signal: controller.signal
                });

                clearTimeout(timer);
                const latency = Date.now() - start;

                if (!response.ok) {
                    const err = await response.text();
                    lastError = err.substring(0, 200);
                    lastStatus = response.status;
                    console.warn(`Gemini model ${model} failed (${response.status}: ${lastError}). Trying next model...`);
                    continue;
                }

                const data: any = await response.json();
                const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';

                if (text) {
                    return { text, provider: 'Gemini', model, latencyMs: latency, status: 200 };
                }
            } catch (e: any) {
                clearTimeout(timer);
                lastError = e.message;
                lastStatus = e.name === 'AbortError' ? 408 : 500;
                console.warn(`Gemini model ${model} exception (${e.message}). Trying next model...`);
            }
        }

        return {
            text: '',
            provider: 'Gemini',
            model: candidates[0],
            latencyMs: 0,
            status: lastStatus,
            error: lastError
        };
    }

    /**
     * Transcribe audio data using Gemini 1.5 Flash.
     */
    async transcribe(audioData: ArrayBuffer, mimeType: string): Promise<string> {
        if (!this.apiKey) throw new Error('GEMINI_API_KEY missing');

        const model = 'gemini-1.5-flash';
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${this.apiKey}`;

        // Convert ArrayBuffer to Base64
        const uint8 = new Uint8Array(audioData);
        let binary = '';
        for (let i = 0; i < uint8.byteLength; i++) {
            binary += String.fromCharCode(uint8[i]);
        }
        const base64 = btoa(binary);

        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{
                    parts: [
                        { text: "Please transcribe this audio exactly as spoken." },
                        {
                            inline_data: {
                                mime_type: mimeType,
                                data: base64
                            }
                        }
                    ]
                }]
            })
        });

        if (!response.ok) {
            const err = await response.text();
            throw new Error(`Gemini transcription failed: ${err}`);
        }

        const data: any = await response.json();
        return data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    }

    /**
     * Analyze image (charts, screenshots, personal photos, food, views) using Gemini Vision.
     */
    async analyzeImage(imageData: ArrayBuffer, mimeType: string, customPrompt?: string): Promise<string> {
        if (!this.apiKey) throw new Error('GEMINI_API_KEY missing');

        const candidates = [
            this.env.GEMINI_MODEL || 'gemini-3.1-flash-lite',
            'gemini-3.5-flash-lite',
            'gemini-flash-lite-latest',
            'gemini-3.8-flash'
        ];

        const uint8 = new Uint8Array(imageData);
        let binary = '';
        for (let i = 0; i < uint8.byteLength; i++) {
            binary += String.fromCharCode(uint8[i]);
        }
        const base64 = btoa(binary);

        const prompt = customPrompt || "أنت 'حواس' — الصديق المصري الذكي خفيف الدم والأصيل. بص على الصورة دي وعلق عليها بأسلوبك المصري التلقائي، السريع البديهة والذكي: لو فيها أكل أو قهوة سمّي وهزر معاه، لو فيها شارت أو مسألة فسرها باحتراف، ولو منظر أو لقطة عفوية شاركه إحساسك وقفشة حلوة تفتح نفسه في سطرين أو ثلاثة!";

        let lastErr = '';
        for (const model of candidates) {
            try {
                const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${this.apiKey}`;
                const response = await fetch(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents: [{
                            parts: [
                                { text: prompt },
                                {
                                    inline_data: {
                                        mime_type: mimeType,
                                        data: base64
                                    }
                                }
                            ]
                        }]
                    })
                });

                if (response.ok) {
                    const data: any = await response.json();
                    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
                    if (text) return text;
                } else {
                    lastErr = await response.text();
                }
            } catch (e: any) {
                lastErr = e.message;
            }
        }

        throw new Error(`Gemini image analysis failed: ${lastErr}`);
    }
}

