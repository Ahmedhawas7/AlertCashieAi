import express from 'express';
import { StorageService } from './services/storage';

export class HealthServer {
    private app = express();
    private startTime = Date.now();
    private storage: StorageService;
    private version = '1.1.0-memu';

    private lastBlock: number | null = null;
    private lastRssGuid: string | null = null;
    private rpcLatencyMs: number = 0;
    private cachedStats: any = null;

    private apiLimit = new Map<string, { count: number, reset: number }>();

    private rateLimit(req: any, res: any, next: any) {
        const ip = req.ip;
        const now = Date.now();
        const limit = 30; // 30 req/min for free tier
        const window = 60000;

        let entry = this.apiLimit.get(ip);
        if (!entry || entry.reset < now) {
            entry = { count: 1, reset: now + window };
        } else {
            entry.count++;
        }
        this.apiLimit.set(ip, entry);

        if (entry.count > limit) {
            return res.status(429).json({ error: 'Too many requests' });
        }
        next();
    }

    constructor(storage: StorageService) {
        this.storage = storage;
        this.setupRoutes();
    }

    public setMetrics(data: { lastBlock?: number; lastRssGuid?: string; rpcLatencyMs?: number, stats?: any }) {
        if (data.lastBlock !== undefined) this.lastBlock = data.lastBlock;
        if (data.lastRssGuid !== undefined) this.lastRssGuid = data.lastRssGuid;
        if (data.rpcLatencyMs !== undefined) this.rpcLatencyMs = data.rpcLatencyMs;
        if (data.stats !== undefined) this.cachedStats = data.stats;
    }

    private setupRoutes() {
        this.app.get('/', (req, res) => {
            res.send(`
                <html>
                    <head><title>CARV Ecosystem Intelligence Agent</title></head>
                    <body style="font-family: sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; background: #0f172a; color: #f8fafc;">
                        <div style="text-align: center; border: 1px solid #334155; padding: 2rem; border-radius: 1rem; background: #1e293b; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);">
                            <h1 style="color: #38bdf8; margin: 0;">AlertCashie</h1>
                            <p style="margin: 1rem 0;">Ecosystem Intelligence Agent is active.</p>
                            <div style="display: flex; gap: 10px; justify-content: center; margin-bottom: 20px;">
                                <a href="/dashboard" style="color: #38bdf8; text-decoration: none; border: 1px solid #334155; padding: 5px 15px; border-radius: 5px;">Dashboard</a>
                                <a href="/health" style="color: #38bdf8; text-decoration: none; border: 1px solid #334155; padding: 5px 15px; border-radius: 5px;">Health</a>
                            </div>
                            <div style="font-size: 0.8rem; color: #94a3b8; border-top: 1px solid #334155; padding-top: 1rem; margin-top: 1rem;">
                                Version: ${this.version} | Uptime: ${Math.floor((Date.now() - this.startTime) / 1000)}s
                            </div>
                        </div>
                    </body>
                </html>
            `);
        });

        this.app.get('/dashboard', async (req, res) => {
            try {
                const stats = await this.storage.getStats();
                const events = await this.storage.getLatestEvents(30);
                const insights = await this.storage.getLatestInsights(5);
                const predictions = await this.storage.getPredictions();

                res.send(`
                    <html>
                        <head>
                            <title>CARV Intelligence Dashboard</title>
                            <style>
                                body { font-family: sans-serif; background: #0f172a; color: #f8fafc; padding: 20px; line-height: 1.5; }
                                .container { max-width: 1200px; margin: 0 auto; }
                                .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; }
                                .card { background: #1e293b; border: 1px solid #334155; padding: 20px; border-radius: 12px; }
                                h1, h2 { color: #38bdf8; }
                                .item { border-bottom: 1px solid #334155; padding: 10px 0; font-size: 0.9rem; }
                                .tag { font-size: 0.7rem; background: #334155; padding: 2px 6px; border-radius: 4px; margin-right: 5px; color: #38bdf8; }
                                .severity-high { border-left: 4px solid #ef4444; padding-left: 8px; }
                                .status-CONFIRMED { color: #10b981; }
                                .status-FAILED { color: #ef4444; }
                                a { color: #38bdf8; text-decoration: none; }
                            </style>
                        </head>
                        <body>
                            <div class="container">
                                <header style="display: flex; justify-content: space-between; align-items: center;">
                                    <h1>Ecosystem Intelligence</h1>
                                    <span style="font-size: 0.8rem; color: #94a3b8;">Uptime: ${Math.floor((Date.now() - this.startTime) / 3600)}h</span>
                                </header>
                                <div class="grid">
                                    <div class="card">
                                        <h2>System Vitality</h2>
                                        <p>Total Events: <strong>${stats.eventCount}</strong></p>
                                        <p>Insights Generated: <strong>${stats.insightCount}</strong></p>
                                        <p>Predictions Tracked: <strong>${stats.predictionCount}</strong></p>
                                    </div>
                                    <div class="card">
                                        <h2>Live Predictions</h2>
                                        ${predictions.length > 0 ? predictions.slice(0, 5).map(p => `
                                            <div class="item">
                                                <strong>${p.title}</strong> (${p.probability}%)<br/>
                                                <small class="status-${p.status}">${p.status}</small>
                                            </div>
                                        `).join('') : '<p>No active predictions yet.</p>'}
                                    </div>
                                </div>
                                <h2 style="margin-top: 40px;">Recent Events</h2>
                                <div class="card">
                                    ${events.map(e => `
                                        <div class="item ${e.severity === 'high' ? 'severity-high' : ''}">
                                            <span class="tag">${e.source}</span>
                                            <span class="tag">${e.type}</span>
                                            <strong>${e.title}</strong> - <small>${e.summary}</small>
                                        </div>
                                    `).join('')}
                                </div>
                            </div>
                        </body>
                    </html>
                `);
            } catch (e) {
                res.send(`Error loading dashboard: ${(e as any).message}`);
            }
        });

        this.app.get('/api/events', (req, res, next) => this.rateLimit(req, res, next), async (req, res) => {
            const limit = parseInt(req.query.limit as string) || 50;
            const type = req.query.type as string;
            res.json(await this.storage.getLatestEvents(limit, type));
        });

        this.app.get('/api/stats', (req, res, next) => this.rateLimit(req, res, next), async (req, res) => {
            res.json(await this.storage.getStats());
        });

        this.app.get('/api/predictions', (req, res, next) => this.rateLimit(req, res, next), async (req, res) => {
            res.json(await this.storage.getPredictions());
        });

        this.app.get('/health', async (req, res) => {
            try {
                // Return cached stats if available to be ultra-fast
                const stats = this.cachedStats || await this.storage.getStats();
                const latestError = await this.storage.getLatestError();

                res.json({
                    status: 'ok',
                    uptimeSeconds: Math.floor((Date.now() - this.startTime) / 1000),
                    version: this.version,
                    lastBlock: this.lastBlock,
                    lastRssGuid: this.lastRssGuid,
                    rpcLatencyMs: this.rpcLatencyMs,
                    stats,
                    latestError: latestError ? {
                        message: latestError.message,
                        timestamp: latestError.timestamp
                    } : null,
                    timestamp: new Date().toISOString()
                });
            } catch (error) {
                res.status(500).json({ status: 'error', message: (error as any).message });
            }
        });

        this.app.get('/metrics', async (req, res) => {
            const stats = await this.storage.getStats();
            let metrics = `# AlertCashie Metrics\n`;
            metrics += `bot_uptime_seconds ${Math.floor((Date.now() - this.startTime) / 1000)}\n`;
            metrics += `events_total ${stats.eventCount}\n`;
            metrics += `insights_total ${stats.insightCount}\n`;
            metrics += `predictions_total ${stats.predictionCount}\n`;
            res.type('text/plain').send(metrics);
        });
    }

    public start() {
        const port = process.env.PORT || 3000;
        this.app.listen(port, () => {
            console.log(`🌐 Intelligence center available at http://localhost:${port}`);

            // Self-ping to prevent sleep
            const selfPingUrl = process.env.SELF_PING_URL;
            if (selfPingUrl) {
                setInterval(async () => {
                    try {
                        const fetch = (await import('node-fetch')).default;
                        await fetch(selfPingUrl);
                    } catch (e) { }
                }, 5 * 60 * 1000);
            }
        });
    }
}
