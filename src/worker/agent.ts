import { Env } from './types';

/**
 * Smart Agent Memory System
 * Stores events and generates insights for the owner
 */

export interface AgentEvent {
    event_type: string;
    event_data?: string;
    telegram_id?: number;
    chat_id?: number;
    timestamp: number;
    metadata?: string;
}

export interface AgentMemory {
    memory_type: string;
    content: string;
    summary?: string;
    telegram_id?: number;
    created_at: number;
    updated_at: number;
    metadata?: string;
}

export class AgentMemorySystem {
    private db: D1Database;
    private env: Env;

    constructor(db: D1Database, env: Env) {
        this.db = db;
        this.env = env;
    }

    /**
     * Log an event to agent memory
     */
    async logEvent(event: Omit<AgentEvent, 'timestamp'>): Promise<void> {
        await this.db.prepare(`
            INSERT INTO agent_logs (event_type, event_data, telegram_id, chat_id, timestamp, metadata)
            VALUES (?, ?, ?, ?, ?, ?)
        `).bind(
            event.event_type,
            event.event_data || null,
            event.telegram_id || null,
            event.chat_id || null,
            Date.now(),
            event.metadata || null
        ).run();
    }

    /**
     * Store a memory summary
     */
    async storeMemory(memory: Omit<AgentMemory, 'created_at' | 'updated_at'>): Promise<void> {
        const now = Date.now();
        await this.db.prepare(`
            INSERT INTO agent_memory (memory_type, content, summary, telegram_id, created_at, updated_at, metadata)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `).bind(
            memory.memory_type,
            memory.content,
            memory.summary || null,
            memory.telegram_id || null,
            now,
            now,
            memory.metadata || null
        ).run();
    }

    /**
     * Get recent events for digest generation
     */
    async getRecentEvents(sinceTimestamp: number, limit: number = 50): Promise<AgentEvent[]> {
        const result = await this.db.prepare(`
            SELECT event_type, event_data, telegram_id, chat_id, timestamp, metadata
            FROM agent_logs
            WHERE timestamp > ?
            ORDER BY timestamp DESC
            LIMIT ?
        `).bind(sinceTimestamp, limit).all<AgentEvent>();

        return result.results || [];
    }

    /**
     * Get memories by type
     */
    async getMemories(memoryType: string, limit: number = 10): Promise<AgentMemory[]> {
        const result = await this.db.prepare(`
            SELECT memory_type, content, summary, telegram_id, created_at, updated_at, metadata
            FROM agent_memory
            WHERE memory_type = ?
            ORDER BY created_at DESC
            LIMIT ?
        `).bind(memoryType, limit).all<AgentMemory>();

        return result.results || [];
    }

    /**
     * Generate daily digest summary
     */
    async generateDailyDigest(): Promise<string> {
        const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
        const events = await this.getRecentEvents(oneDayAgo);

        if (events.length === 0) {
            return '📊 لا توجد أحداث جديدة اليوم.';
        }

        // Group events by type
        const eventsByType: Record<string, number> = {};
        events.forEach(event => {
            eventsByType[event.event_type] = (eventsByType[event.event_type] || 0) + 1;
        });

        let digest = '📊 **ملخص يومي**\n\n';
        digest += `📅 ${new Date().toLocaleDateString('ar-EG')}\n\n`;
        digest += `🔢 إجمالي الأحداث: ${events.length}\n\n`;
        digest += '📋 **تفصيل الأحداث:**\n';

        for (const [type, count] of Object.entries(eventsByType)) {
            digest += `• ${type}: ${count}\n`;
        }

        return digest;
    }

    /**
     * Get agent status
     */
    async getStatus(): Promise<string> {
        // Get total events
        const totalEventsResult = await this.db.prepare(`
            SELECT COUNT(*) as count FROM agent_logs
        `).first<{ count: number }>();

        const totalEvents = totalEventsResult?.count || 0;

        // Get total memories
        const totalMemoriesResult = await this.db.prepare(`
            SELECT COUNT(*) as count FROM agent_memory
        `).first<{ count: number }>();

        const totalMemories = totalMemoriesResult?.count || 0;

        // Get recent activity (last 24h)
        const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
        const recentEventsResult = await this.db.prepare(`
            SELECT COUNT(*) as count FROM agent_logs WHERE timestamp > ?
        `).bind(oneDayAgo).first<{ count: number }>();

        const recentEvents = recentEventsResult?.count || 0;

        return `🤖 **حالة الوكيل الذكي**\n\n` +
            `📊 إجمالي الأحداث: ${totalEvents}\n` +
            `🧠 إجمالي الذكريات: ${totalMemories}\n` +
            `⚡ نشاط آخر 24 ساعة: ${recentEvents}\n` +
            `🕐 الوقت: ${new Date().toLocaleString('ar-EG')}`;
    }
}
