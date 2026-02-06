import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Env } from './types';

export class DB {
    private client: SupabaseClient;

    constructor(env: Env) {
        this.client = createClient(env.SUPABASE_URL, env.SUPABASE_KEY, {
            auth: { persistSession: false }
        });
    }

    async getGroupSettings(chatId: number) {
        const { data } = await this.client
            .from('GroupSettings')
            .select('*')
            .eq('chatId', String(chatId))
            .single();
        return data; // returns null if not found
    }

    async setGroupSettings(chatId: number, settings: { mode?: string, lang?: string }) {
        return await this.client
            .from('GroupSettings')
            .upsert({ chatId: String(chatId), ...settings });
    }

    async searchKnowledge(query: string): Promise<{ answer: string, confidence: number } | null> {
        // Simple search for now: check exact match or "contains". 
        // For better search, we'd need pgvector, but trying to keep it simple/free.
        // Let's try to match tags or simple text search if supported, 
        // or just fetch all knowledge (if small) and filter.
        // Since this is a lightweight worker, let's use Supabase text search if possible 
        // or just "like" query.

        // 1. Try exact match on question
        let { data } = await this.client
            .from('Knowledge')
            .select('answer, confidence')
            .eq('question', query) // normalization logic should be in handler
            .single();

        if (data) return data;

        // 2. Try partial match
        // Note: ilike is case-insensitive
        const { data: list } = await this.client
            .from('Knowledge')
            .select('answer, confidence')
            .ilike('question', `%${query}%`)
            .limit(1);

        return list && list.length > 0 ? list[0] : null;
    }

    async saveKnowledge(question: string, answer: string, isTentative = false) {
        return await this.client
            .from('Knowledge')
            .insert({ question, answer, confidence: 1.0, isTentative });
    }

    async saveUser(user: { id: number, username?: string, first_name?: string }) {
        // Fire and forget, don't await this usually
        return await this.client
            .from('User')
            .upsert({
                telegramId: String(user.id),
                // We might want to store username/name in a different table or json field
                // but schema only has basic fields. Just ensuring existence for now.
            })
            .select();
    }
}
