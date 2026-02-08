import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Env } from './types';

export class DB {
    private client: SupabaseClient | null;

    constructor(env: Env) {
        // Make Supabase optional - only initialize if credentials are provided
        if (env.SUPABASE_URL && env.SUPABASE_KEY) {
            this.client = createClient(env.SUPABASE_URL, env.SUPABASE_KEY, {
                auth: { persistSession: false }
            });
        } else {
            this.client = null;
            console.log('Supabase not configured - knowledge features disabled');
        }
    }

    async getGroupSettings(chatId: number) {
        if (!this.client) return null;
        const { data } = await this.client
            .from('GroupSettings')
            .select('*')
            .eq('chatId', String(chatId))
            .single();
        return data; // returns null if not found
    }

    async setGroupSettings(chatId: number, settings: { mode?: string, lang?: string }) {
        if (!this.client) return null;
        return await this.client
            .from('GroupSettings')
            .upsert({ chatId: String(chatId), ...settings });
    }

    async searchKnowledge(query: string): Promise<{ answer: string, confidence: number } | null> {
        if (!this.client) return null;

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
        if (!this.client) return null;
        return await this.client
            .from('Knowledge')
            .insert({ question, answer, confidence: 1.0, isTentative });
    }

    async saveUser(user: { id: number, username?: string, first_name?: string }) {
        if (!this.client) return null;
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

    async getUser(userId: number) {
        if (!this.client) return null;
        const { data } = await this.client
            .from('User')
            .select('*')
            .eq('telegramId', String(userId))
            .single();
        return data;
    }

    async updateUser(userId: number, updates: { lastInteractedAt?: string, first_name?: string, lang?: string }) {
        if (!this.client) return null;
        return await this.client
            .from('User')
            .upsert({
                telegramId: String(userId),
                ...updates,
                updatedAt: new Date().toISOString()
            })
            .select();
    }
}
