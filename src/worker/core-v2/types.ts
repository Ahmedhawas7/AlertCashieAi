export interface TelegramUpdate {
    update_id: number;
    message?: any;
    callback_query?: any;
}

export interface ExecutionContext {
    waitUntil(promise: Promise<any>): void;
    passThroughOnException(): void;
}

export interface Env {
    DB: D1Database;
    BOT_TOKEN: string;
    GEMINI_API_KEY: string;
    GROQ_API_KEY: string;
    AI_ENABLED_DEFAULT: string;
    TELEGRAM_ADMIN_IDS: string;
    CARV_REDIRECT_URL: string;
    CARV_CLIENT_ID: string;
    CARV_CLIENT_SECRET: string;
}

export interface ProcessingContext {
    userId: string;
    chatId: number;
    platform: 'telegram';
}

export interface BrainResponse {
    type: 'text' | 'command' | 'action';
    text: string;
    data?: any;
}

export type Intent = 'chat' | 'command' | 'transaction' | 'analysis' | 'price_check';

export interface IStorage {
    get(key: string): Promise<string | null>;
    set(key: string, value: string): Promise<void>;
}

export interface IAIProvider {
    isEnabled(): boolean;
    generateResponse(ctx: ProcessingContext, prompt: string, intent: Intent): Promise<BrainResponse>;
}
