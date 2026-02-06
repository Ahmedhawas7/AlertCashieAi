export interface Env {
    BOT_TOKEN: string;
    SUPABASE_URL: string;
    SUPABASE_KEY: string;
    TELEGRAM_ADMIN_IDS: string;
    DEFAULT_GROUP_MODE: string;
    DEFAULT_GROUP_LANG: string;
    GEMINI_API_KEY?: string;
    AI_ENABLED_DEFAULT: string;
}

export interface TelegramUpdate {
    update_id: number;
    message?: TelegramMessage;
    edited_message?: TelegramMessage;
    channel_post?: TelegramMessage;
}

export interface TelegramMessage {
    message_id: number;
    from?: TelegramUser;
    chat: TelegramChat;
    date: number;
    text?: string;
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
}
