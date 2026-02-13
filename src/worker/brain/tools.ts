import { Env } from '../types';
import { MemoryManager, UserFact } from './memory';
import { FreeAiSearch } from '../freeai/search';
import { composeAnswer } from '../freeai/answer';
import { FreeAiPlanner } from '../freeai/planner';
import type { Citation } from '../freeai/types';

/**
 * Internal Tool System for BrainV2
 * These are TypeScript functions, NOT AI SDK tools
 */

export interface ToolResult {
    tool: string;
    success: boolean;
    result: any;
    error?: string;
}

export class BrainTools {
    private db: D1Database;
    private env: Env;
    private memory: MemoryManager;
    private freeaiSearch: FreeAiSearch;
    private freeaiPlanner: FreeAiPlanner;

    constructor(db: D1Database, env: Env) {
        this.db = db;
        this.env = env;
        this.memory = new MemoryManager(db);
        this.freeaiSearch = new FreeAiSearch(db);
        this.freeaiPlanner = new FreeAiPlanner(db);
    }

    /**
     * Execute a tool by name
     */
    async executeTool(toolName: string, params: any): Promise<ToolResult> {
        try {
            switch (toolName) {
                case 'memory_get':
                    return await this.tool_memory_get(params.userId);

                case 'memory_add':
                    return await this.tool_memory_add(
                        params.userId,
                        params.key,
                        params.value,
                        params.confidence || 1.0
                    );

                case 'freeai_ask':
                    return await this.tool_freeai_ask(params.question);

                case 'freeai_search':
                    return await this.tool_freeai_search(params.query);

                case 'freeai_ingest':
                    return await this.tool_freeai_ingest(params.url);

                case 'recent_events':
                    return await this.tool_recent_events(params.limit || 5);

                case 'resolve_recipient':
                    return await this.tool_resolve_recipient(params.mention);

                default:
                    return {
                        tool: toolName,
                        success: false,
                        result: null,
                        error: `Unknown tool: ${toolName}`
                    };
            }
        } catch (err: any) {
            return {
                tool: toolName,
                success: false,
                result: null,
                error: err.message
            };
        }
    }

    /**
     * Get user's memory facts
     */
    private async tool_memory_get(userId: string): Promise<ToolResult> {
        const facts = await this.memory.getAllFacts(userId);
        return {
            tool: 'memory_get',
            success: true,
            result: facts
        };
    }

    /**
     * Add a memory fact
     */
    private async tool_memory_add(
        userId: string,
        key: string,
        value: string,
        confidence: number
    ): Promise<ToolResult> {
        await this.memory.storeFact(userId, key, value, confidence);
        return {
            tool: 'memory_add',
            success: true,
            result: { key, value, confidence }
        };
    }

    /**
     * Ask FreeAI with grounded search
     */
    private async tool_freeai_ask(question: string): Promise<ToolResult> {
        const citations = await this.freeaiSearch.search(question, 3);
        if (citations.length === 0) {
            return {
                tool: 'freeai_ask',
                success: false,
                result: null,
                error: 'No relevant citations found'
            };
        }

        const aiResult = composeAnswer(question, citations);
        return {
            tool: 'freeai_ask',
            success: true,
            result: {
                answer: aiResult.answer,
                citations: aiResult.citations
            }
        };
    }

    /**
     * Search FreeAI knowledge base
     */
    private async tool_freeai_search(query: string): Promise<ToolResult> {
        const citations = await this.freeaiSearch.search(query, 5);
        return {
            tool: 'freeai_search',
            success: true,
            result: citations
        };
    }

    /**
     * Ingest URL into FreeAI
     */
    private async tool_freeai_ingest(url: string): Promise<ToolResult> {
        const result = await this.freeaiPlanner.ingestUrl(url, 'brain_tool');
        return {
            tool: 'freeai_ingest',
            success: true,
            result: {
                title: result.title,
                tldr: result.tldr
            }
        };
    }

    /**
     * Get recent blockchain events (stub for now)
     */
    private async tool_recent_events(limit: number): Promise<ToolResult> {
        // TODO: Integrate with BaseLogsWatcher or transaction history
        const events = await this.db.prepare(`
            SELECT tx_hash, recipient, amount, token, created_at
            FROM pending_tx
            WHERE status = 'executed'
            ORDER BY created_at DESC
            LIMIT ?
        `).bind(limit).all<any>();

        return {
            tool: 'recent_events',
            success: true,
            result: events.results || []
        };
    }

    /**
     * Resolve @mention to wallet address
     */
    private async tool_resolve_recipient(mention: string): Promise<ToolResult> {
        // Remove @ prefix
        const username = mention.startsWith('@') ? mention.substring(1) : mention;

        // Look up in memories (wallet mappings)
        const wallet = await this.db.prepare(
            "SELECT value as wallet_address FROM user_memory WHERE key = ? LIMIT 1"
        ).bind(`wallet_${username.toLowerCase()}`).first<{ wallet_address: string }>();

        if (wallet?.wallet_address) {
            return {
                tool: 'resolve_recipient',
                success: true,
                result: { address: wallet.wallet_address, source: 'memory' }
            };
        }

        // Check CARV connections (by username or email)
        const carvUser = await this.db.prepare(
            "SELECT smart_wallet_address FROM carv_connections WHERE telegram_user_id = (SELECT id FROM users WHERE username = ? LIMIT 1) LIMIT 1"
        ).bind(username).first<{ smart_wallet_address: string }>();

        if (carvUser?.smart_wallet_address) {
            return {
                tool: 'resolve_recipient',
                success: true,
                result: { address: carvUser.smart_wallet_address, source: 'carv' }
            };
        }

        return {
            tool: 'resolve_recipient',
            success: false,
            result: null,
            error: `No wallet found for @${username}`
        };
    }
}
