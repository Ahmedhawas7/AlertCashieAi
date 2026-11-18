/// <reference path="./d1.d.ts" />

export interface Env {
    BOT_TOKEN: string;
    SUPABASE_URL: string;
    SUPABASE_KEY: string;
    TELEGRAM_ADMIN_IDS: string;
    DEFAULT_GROUP_MODE: string;
    DEFAULT_GROUP_LANG: string;
    GEMINI_API_KEY?: string;
    GEMINI_MODEL?: string;
    DEEPSEEK_API_KEY?: string;
    DEEPSEEK_BASE_URL?: string;
    DEEPSEEK_MODEL?: string;
    AI_ENABLED_DEFAULT?: string;
    AI_DAILY_LIMIT?: string;
    AI_MAX_TOKENS?: string;
    AI_TIMEOUT_MS?: string;
    OPENROUTER_API_KEY?: string;
    OPENROUTER_MODEL?: string;

    // FreeAI — free-claude-code proxy (61+ providers, 1.3B+ free tokens/month)
    // https://github.com/Alishahryar1/free-claude-code
    FREEAI_BASE_URL?: string;       // e.g. http://localhost:3000/v1 or your tunnel URL
    FREEAI_API_KEY?: string;        // default: 'fcc' (when proxy auth is disabled)
    FREEAI_MODEL?: string;          // e.g. nvidia_nim/nvidia/nemotron-3-super-120b-a12b

    // Groq Multi-Model Configuration
    GROQ_API_KEY?: string;
    GROQ_BASE_URL?: string;
    GROQ_MODEL_PRIMARY?: string;
    GROQ_MODEL_FALLBACK?: string;
    GROQ_MODEL_FAST?: string;
    AI_TEMPERATURE?: string;
    AI_TOP_P?: string;

    // CARV ID OAuth
    DB: D1Database;
    OWNER_TELEGRAM_ID: string;
    CARV_CLIENT_ID: string;
    CARV_CLIENT_SECRET: string;
    CARV_REDIRECT_URL: string;
    CARV_AUTH_URL?: string;
    CARV_TOKEN_URL?: string;
    CARV_USERINFO_URL?: string;
    ENCRYPTION_SECRET?: string;
    BASE_RPC_URL?: string;
    BASE_PRIVATE_KEY?: string; // Secret
    USDC_BASE_ADDRESS?: string;
    BASE_BUILDER_CODE?: string;
    BASE_BUILDER_ENCODED?: string;

    // Agent Personality
    DEFAULT_PERSONA?: 'calm' | 'hype' | 'strict';

    // WhatsApp Cloud API Integration
    WHATSAPP_ACCESS_TOKEN?: string;
    WHATSAPP_PHONE_NUMBER_ID?: string;
    WHATSAPP_VERIFY_TOKEN?: string;
}

export interface SessionKey {
    id: number;
    user_id: string;
    wallet_address: string;
    session_public_key: string;
    session_private_key: string;
    permissions: string;
    expires_at: number;
    created_at: number;
}

export interface PendingTx {
    id: number;
    user_id: string;
    recipient: string;
    token: string;
    amount: string;
    data?: string;
    status: 'pending' | 'executed' | 'failed' | 'cancelled';
    tx_hash?: string;
    created_at: number;
}

export interface AgentMessage {
    id: number;
    chat_id: number;
    role: 'user' | 'bot';
    text: string;
    ts: number;
}

export interface AgentMemoryItem {
    id: number;
    chat_id: number;
    type: 'preference' | 'goal' | 'fact' | 'habit' | 'setting' | 'identity';
    key: string;
    value: string;
    tags?: string;
    score?: number;
    confidence: number;
    ts: number;
    deprecated: number;
}

export interface AgentSummary {
    id: number;
    chat_id: number;
    day: string; // YYYY-MM-DD
    summary: string;
    ts: number;
}

export interface ReplyHistory {
    id: number;
    chat_id: number;
    reply: string;
    ts: number;
}

export interface BotSettings {
    chat_id: number;
    persona: 'calm' | 'hype' | 'strict';
    ai_enabled: number;
    daily_ai_limit: number;
    ai_calls_today: number;
    last_reset_day?: string;
}

export interface TelegramUpdate {
    update_id: number;
    message?: TelegramMessage;
    edited_message?: TelegramMessage;
    channel_post?: TelegramMessage;
    callback_query?: TelegramCallbackQuery;
}

export interface TelegramCallbackQuery {
    id: string;
    from: TelegramUser;
    message?: TelegramMessage;
    data?: string;
}

export interface TelegramMessage {
    message_id: number;
    message_thread_id?: number;
    from?: TelegramUser;
    chat: TelegramChat;
    date: number;
    text?: string;
    caption?: string;
    reply_to_message?: TelegramMessage;
}

export interface TelegramUser {
    id: number;
    is_bot: boolean;
    first_name: string;
    username?: string;
    language_code?: string;
}

export interface TelegramChat {
    id: number;
    type: 'private' | 'group' | 'supergroup' | 'channel';
    title?: string;
    username?: string;
}

export interface HawasResponse {
    text: string;
    method?: 'sendMessage' | 'reply'; // default reply
    reply_markup?: any;
    taskId?: string;
}

// Cloudflare Workers types
export interface ScheduledEvent {
    scheduledTime: number;
    cron: string;
}

export interface ExecutionContext {
    waitUntil(promise: Promise<any>): void;
    passThroughOnException(): void;
}

export interface BrainReasoningLog {
    user_id: string;
    intent: string;
    entities: string;
    memory_used_keys: string[];
    context_count: number;
    tools_used: string[];
    planner_ran: boolean;
    timestamp: number;
}
export interface ToolResult {
    tool: string;
    success: boolean;
    result?: any;
    error?: string;
}
