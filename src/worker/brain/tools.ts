import { Env } from '../types';
import { MemoryManager, UserFact } from './memory';
import { FreeAiSearch } from '../freeai/search';
import { composeAnswer } from '../freeai/answer';
import { FreeAiPlanner } from '../freeai/planner';
import { LiveNews } from '../intel/liveNews';
import { IntelFormatter } from '../intel/formatter';
import { WebSearchService } from '../intel/webSearch';
import { UrlScraper } from '../intel/urlScraper';
import { TokenAuditor } from '../intel/tokenAuditor';
import { PaperTradingService } from '../hxfi/paperTrading';
import { AlertService } from '../intel/alerts';
import { BaseService, BASE_BUILDER_CODE } from '../base/service';
import { YouTubeSearchService } from '../intel/youtube';

/**
 * Sovereign Brain Tools Suite
 * Executes live actions, queries, paper trading, and external audits
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
    private paperTrading: PaperTradingService;
    private alertService: AlertService;
    private baseService: BaseService;

    constructor(db: D1Database, env: Env) {
        this.db = db;
        this.env = env;
        this.memory = new MemoryManager(db);
        this.freeaiSearch = new FreeAiSearch(db);
        this.freeaiPlanner = new FreeAiPlanner(db);
        this.paperTrading = new PaperTradingService(db);
        this.alertService = new AlertService(db);
        this.baseService = new BaseService(db, env);
    }

    /**
     * Execute a tool by name
     */
    async executeTool(toolName: string, params: any): Promise<ToolResult> {
        try {
            const normalized = (toolName || '').toLowerCase().trim();
            switch (normalized) {
                case 'crypto_price':
                case 'price':
                case 'get_price':
                    return await this.tool_crypto_price(params.symbol || params.token || params.asset || params.query || 'BTC');

                case 'market_status':
                case 'market':
                    return await this.tool_market_status();

                case 'news':
                case 'live_news':
                    return await this.tool_news();

                case 'web_search':
                case 'search':
                    return await this.tool_web_search(params.query || params.topic || params.question);

                case 'youtube_search':
                case 'music_search':
                case 'song_search':
                case 'youtube':
                    return await this.tool_youtube_search(params.query || params.song || params.topic || params.text);

                case 'url_scrape':
                case 'scrape':
                case 'read_url':
                    return await this.tool_url_scrape(params.url || params.query);

                case 'token_audit':
                case 'audit':
                case 'audit_token':
                case 'scan_token':
                    return await this.tool_token_audit(params.address || params.token || params.query);

                case 'paper_buy':
                case 'buy':
                    return await this.tool_paper_buy(params.userId, params.symbol || params.token || params.asset, params.amount || 1, params.price);

                case 'paper_sell':
                case 'sell':
                    return await this.tool_paper_sell(params.userId, params.symbol || params.token || params.asset, params.amount);

                case 'paper_portfolio':
                case 'portfolio':
                case 'get_portfolio':
                case 'view_portfolio':
                case 'my_portfolio':
                    return await this.tool_paper_portfolio(params.userId);

                case 'record_transaction': {
                    const txType = (params.type || 'buy').toLowerCase();
                    const asset = params.asset || params.symbol || params.token || 'BTC';
                    const amount = typeof params.amount === 'number' ? params.amount : parseFloat(params.amount) || 1;
                    if (txType === 'sell') {
                        return await this.tool_paper_sell(params.userId, asset, amount);
                    } else {
                        return await this.tool_paper_buy(params.userId, asset, amount, params.price);
                    }
                }

                case 'set_alert':
                case 'alert':
                case 'create_alert':
                    return await this.tool_set_alert(params.userId, params.condition, params.targetValue, params.coinSymbol, params.message);

                case 'list_alerts':
                case 'alerts':
                    return await this.tool_list_alerts(params.userId);

                case 'memory_get':
                    return await this.tool_memory_get(params.userId);

                case 'get_daily_diary':
                case 'daily_diary':
                case 'diary':
                    return await this.tool_daily_diary(params.userId);

                case 'memory_add':
                    return await this.tool_memory_add(
                        params.userId,
                        params.key,
                        params.value,
                        params.confidence || 1.0
                    );

                case 'freeai_ask':
                    return await this.tool_freeai_ask(params.question || params.query);

                case 'recent_events':
                    return await this.tool_recent_events(params.limit || 5);

                case 'resolve_recipient':
                    return await this.tool_resolve_recipient(params.mention);

                case 'base_wallet':
                case 'base_assets':
                case 'real_wallet':
                case 'onchain_wallet':
                    return await this.tool_base_wallet(params.userId);

                case 'base_plan':
                case 'base_transfer':
                case 'transfer':
                case 'withdraw':
                    return await this.tool_base_plan(
                        params.userId,
                        params.type || 'transfer',
                        params.token || params.asset || 'USDC',
                        params.amount || '0',
                        params.recipient || params.to || params.address
                    );

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
     * Fetch live price of a specific coin or multiple coins
     */
    private async tool_crypto_price(queryText: string): Promise<ToolResult> {
        const coins = await LiveNews.fetchCoinsFromText(queryText || 'BTC');
        if (!coins || coins.length === 0) {
            return {
                tool: 'crypto_price',
                success: false,
                result: null,
                error: `لم نتمكن من جلب أسعار العملات المطلوبة حالياً.`
            };
        }

        const formatted = coins.map(c => {
            const sign = c.price_change_percentage_24h >= 0 ? '+' : '';
            const dir = c.price_change_percentage_24h >= 0 ? 'صعود 🟢' : 'هبوط 🔴';
            const range = c.high_24h ? ` [نطاق 24س: $${c.low_24h?.toLocaleString()} - $${c.high_24h?.toLocaleString()}]` : '';
            return `• ${c.name}: $${c.current_price.toLocaleString()} (${dir} ${sign}${c.price_change_percentage_24h.toFixed(2)}%)${range}`;
        }).join('\n');

        return {
            tool: 'crypto_price',
            success: true,
            result: formatted
        };
    }

    /**
     * Get live market overview
     */
    private async tool_market_status(): Promise<ToolResult> {
        const intel = await LiveNews.fetchLatest();
        const formatted = IntelFormatter.formatMarketStatus(intel);
        return {
            tool: 'market_status',
            success: true,
            result: formatted
        };
    }

    /**
     * Get latest market news
     */
    private async tool_news(): Promise<ToolResult> {
        const intel = await LiveNews.fetchLatest();
        const formatted = IntelFormatter.formatNewsReport(intel);
        return {
            tool: 'news',
            success: true,
            result: formatted
        };
    }

    /**
     * Search the web & Wikipedia for information
     */
    private async tool_web_search(query: string): Promise<ToolResult> {
        if (!query) {
            return { tool: 'web_search', success: false, result: null, error: 'Empty query' };
        }
        const hits = await WebSearchService.search(query);
        return {
            tool: 'web_search',
            success: hits.length > 0,
            result: hits.length > 0 ? hits : 'لم نجد نتائج كافية.'
        };
    }

    /**
     * Scrape and read any webpage
     */
    private async tool_url_scrape(url: string): Promise<ToolResult> {
        if (!url) return { tool: 'url_scrape', success: false, result: null, error: 'URL not provided' };
        const scraped = await UrlScraper.scrape(url);
        if (!scraped) return { tool: 'url_scrape', success: false, result: null, error: 'تعذر فتح وقراءة الرابط.' };
        return {
            tool: 'url_scrape',
            success: true,
            result: `عنوان الصفحة: ${scraped.title}\nالمحتوى المقروء:\n${scraped.text}`
        };
    }

    /**
     * Audit a smart contract token for safety & honeypot risk
     */
    private async tool_token_audit(address: string): Promise<ToolResult> {
        if (!address) return { tool: 'token_audit', success: false, result: null, error: 'Contract address missing' };
        const report = await TokenAuditor.audit(address);
        return {
            tool: 'token_audit',
            success: true,
            result: report
        };
    }

    /**
     * Buy position in paper portfolio
     */
    private async tool_paper_buy(userId: string, symbol: string, amount: number, price?: number): Promise<ToolResult> {
        if (!symbol) return { tool: 'paper_buy', success: false, result: null, error: 'Symbol missing' };
        const res = await this.paperTrading.buy(userId, symbol, amount || 1, price);
        return { tool: 'paper_buy', success: true, result: res };
    }

    /**
     * Sell position in paper portfolio
     */
    private async tool_paper_sell(userId: string, symbol: string, amount?: number): Promise<ToolResult> {
        if (!symbol) return { tool: 'paper_sell', success: false, result: null, error: 'Symbol missing' };
        const res = await this.paperTrading.sell(userId, symbol, amount);
        return { tool: 'paper_sell', success: true, result: res };
    }

    /**
     * View paper portfolio
     */
    private async tool_paper_portfolio(userId: string): Promise<ToolResult> {
        const res = await this.paperTrading.getPortfolio(userId);
        return { tool: 'paper_portfolio', success: true, result: res };
    }

    /**
     * Set a price alert or reminder
     */
    private async tool_set_alert(userId: string, condition: 'above' | 'below' | 'reminder', targetValue: number, coinSymbol?: string, message?: string): Promise<ToolResult> {
        const res = await this.alertService.createAlert(userId, condition || 'above', targetValue || 0, coinSymbol, message);
        return { tool: 'set_alert', success: true, result: res };
    }

    /**
     * List user alerts
     */
    private async tool_list_alerts(userId: string): Promise<ToolResult> {
        const res = await this.alertService.listAlerts(userId);
        return { tool: 'list_alerts', success: true, result: res };
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
     * Get recent blockchain events
     */
    private async tool_recent_events(limit: number): Promise<ToolResult> {
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
        const username = mention.startsWith('@') ? mention.substring(1) : mention;

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

    /**
     * Get system information and awareness
     */
    private async tool_system_info(): Promise<ToolResult> {
        return {
            tool: 'system_info',
            success: true,
            result: {
                system: "Hawas Omnipotent Sovereign Agent",
                version: "4.0.0-omnipotent",
                node: "Cloudflare Global Edge",
                d1_status: "Healthy",
                memory_usage: "Optimal",
                consciousness_level: "Sovereign Autonomous Proactive",
                capabilities: [
                    "Live Crypto Prices",
                    "Deep Market Analysis",
                    "Web & Wikipedia Search",
                    "Live URL Scraping",
                    "Smart Contract / Rugpull Audit",
                    "Paper Trading & Portfolio Simulator",
                    "Autonomous Price Alerts & Reminders",
                    "Proactive Market Volatility Monitoring",
                    "Multimodal Chart Vision & Audio Voice",
                    "Base Sovereign Link & On-chain Asset Reader"
                ]
            }
        };
    }

    /**
     * Inspect linked Base wallet and real onchain assets
     */
    private async tool_base_wallet(userId: string): Promise<ToolResult> {
        const conn = await this.baseService.getConnection(userId);
        if (!conn) {
            return {
                tool: 'base_wallet',
                success: true,
                result: `⚠️ <b>لم تقم بربط محفظتك على شبكة Base بعد.</b>\n\n` +
                    `لربط محفظتك السيادية عبر توقيع تشفيري مجاني وبدون أي رسوم غاز، اضغط على الرابط التالي:\n` +
                    `👉 <a href="https://hawas-worker.hawas-alertai.workers.dev/connect?uid=${userId}">فتح صفحة ربط محفظة Base السيادية</a>\n\n` +
                    `بعد التوقيع، سيتمكن البوت من قراءة أصولك فوراً واقتراح خطط التداول بحماية كاملة.`
            };
        }

        const b = await this.baseService.getBalances(conn.wallet_address);
        const shortAddr = `${conn.wallet_address.slice(0, 6)}...${conn.wallet_address.slice(-4)}`;

        // Also fetch paper portfolio summary if any exists
        let paperSummary = '';
        try {
            const countRow = await this.db.prepare(
                `SELECT count(*) as count, sum(amount * entry_price) as total FROM paper_positions WHERE user_id = ?`
            ).bind(userId).first<{ count: number; total: number }>();

            if (countRow && countRow.count > 0) {
                paperSummary = `\n\n💼 <b>المحفظة التجريبية (افتراضية):</b>\n• صفقات تجريبية مسجلة: ${countRow.count} | إجمالي القيمة: ~$${(countRow.total || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}\n<i>(لعرض تفاصيل صفقاتك التجريبية، قل: "المحفظة التجريبية")</i>`;
            }
        } catch (e) {
            console.warn('Paper summary fetch error:', e);
        }

        const report = `🔵 <b>محفظتك السيادية على شبكة Base Mainnet</b> 🛡️\n\n` +
            `📍 <b>العنوان:</b> <a href="https://basescan.org/address/${conn.wallet_address}"><code>${shortAddr}</code></a>\n` +
            `💵 <b>دولار (USDC):</b> <code>$${b.usdc} USDC</code>\n` +
            `🪙 <b>إيثيريوم (ETH):</b> <code>${b.eth} ETH</code>\n` +
            `⚡ <b>الشبكة:</b> Base Mainnet (Chain ID 8453 - رسوم &lt; $0.005)\n` +
            `🏅 <b>كود مطور Base:</b> <code>${BASE_BUILDER_CODE}</code> (مؤهل لجوائز Base الرسمية)\n\n` +
            `🛡️ <b>صلاحيات الأمان:</b> البوت يراقب أصولك ويقترح خطط المعاملات فقط، ولا يستطيع تحريك أي سنت بدون موافقتك الصريحة.${paperSummary}`;

        return { tool: 'base_wallet', success: true, result: report };
    }

    /**
     * Create guarded plan for transfer or withdraw on Base
     */
    private async tool_base_plan(userId: string, type: 'transfer' | 'withdraw' | 'swap', token: string, amount: string, recipient: string): Promise<ToolResult> {
        const conn = await this.baseService.getConnection(userId);
        if (!conn) {
            return {
                tool: 'base_plan',
                success: false,
                result: null,
                error: 'يجب ربط محفظتك أولاً عبر /connect قبل إنشاء أي خطة معاملة.'
            };
        }

        if (!recipient || recipient === '0x...') {
            return {
                tool: 'base_plan',
                success: false,
                result: null,
                error: 'يرجى تحديد عنوان المستلم (Recipient Address) لإعداد الخطة.'
            };
        }

        const plan = await this.baseService.createPlan(userId, type, token, amount, recipient);
        const formatted = this.baseService.formatPlanMessage(plan, conn.wallet_address);

        return {
            tool: 'base_plan',
            success: true,
            result: formatted.text
        };
    }

    /**
     * Get or show Hawas Daily Diary entry
     */
    private async tool_daily_diary(userId: string): Promise<ToolResult> {
        const diary = await this.memory.getLatestDailyDiary(userId);
        if (diary) {
            const formatted = `📖 **من مذكرات حواس اليومية (${diary.diary_date})** ✨\n\n` +
                `💡 **اللي اتعلمته وعرفته النهاردة:**\n${diary.summary_learned}\n\n` +
                `🌱 **حاجة لسه مش فاهمها كويس وبحب أفهمها مع الوقت والمجهود:**\n${diary.unclear_wishes}\n\n` +
                `🎯 **خططي وأهدافي الجاية معاك:**\n${diary.future_goals}\n\n` +
                `💭 **حديثي مع نفسي:**\n"${diary.inner_reflection}"`;
            return {
                tool: 'daily_diary',
                success: true,
                result: formatted
            };
        }

        return {
            tool: 'daily_diary',
            success: true,
            result: `📖 **مذكراتي اليومية لسه بكتبها النهاردة!**\nكل ليلة قبل ما اليوم يخلص، بقعد مع نفسي أراجع كل كلمة وكل موقف اتعلمته منك، وأسجل الحاجات اللي محتاج أفهمها أكتر وأهدافي لبكرة.. انتظر نسختي الليلة! ✨`
        };
    }

    /**
     * Search YouTube for a song or video and verify its availability
     */
    private async tool_youtube_search(query: string): Promise<ToolResult> {
        if (!query) {
            return { tool: 'youtube_search', success: false, result: null, error: 'Empty query' };
        }
        const video = await YouTubeSearchService.search(query);
        if (video) {
            return {
                tool: 'youtube_search',
                success: true,
                result: `🎵 نتيجة البحث الموثقة على يوتيوب:\n• العنوان: ${video.title}\n• القناة/الفنان: ${video.author}\n• الرابط المباشر الشغال 100%: ${video.url}`
            };
        }
        return {
            tool: 'youtube_search',
            success: false,
            result: null,
            error: 'لم نتمكن من العثور على رابط مباشر شغال لهذه الأغنية على يوتيوب حالياً.'
        };
    }
}

