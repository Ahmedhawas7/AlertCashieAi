import { PrismaClient, Event } from '@prisma/client';

export class StorageService {
    private prisma: PrismaClient;

    constructor() {
        this.prisma = new PrismaClient();
    }

    async saveEvent(data: Omit<Event, 'id' | 'timestamp'>) {
        if (data.rawRef) {
            const existing = await this.prisma.event.findUnique({
                where: { rawRef: data.rawRef }
            });
            if (existing) return existing;
        }
        return await this.prisma.event.create({
            data: {
                ...data,
            },
        });
    }

    async getLatestEvents(limit = 50, type?: string) {
        return await this.prisma.event.findMany({
            where: type ? { type } : {},
            orderBy: { timestamp: 'desc' },
            take: limit,
        });
    }

    async getWatcherState(id: string) {
        return await this.prisma.watcherState.findUnique({
            where: { id },
        });
    }

    async updateWatcherState(id: string, state: { lastBlock?: number, lastSeen?: string }) {
        return await this.prisma.watcherState.upsert({
            where: { id },
            update: state,
            create: { id, ...state },
        });
    }

    async getUser(telegramId: string) {
        return await this.prisma.user.findUnique({
            where: { telegramId },
        });
    }

    async saveUser(telegramId: string, data: { carvId?: string, evmAddress?: string, isAdmin?: boolean }) {
        return await this.prisma.user.upsert({
            where: { telegramId },
            update: data,
            create: { telegramId, ...data },
        });
    }

    async getAllUsers() {
        return await this.prisma.user.findMany();
    }

    async logError(message: string, stack?: string) {
        console.error(`[ERROR] ${message}`, stack);
        return await this.prisma.errorLog.create({
            data: { message, stack },
        });
    }

    async getLatestError() {
        return await this.prisma.errorLog.findFirst({
            orderBy: { timestamp: 'desc' },
        });
    }

    async getStats() {
        const [eventCount, errorCount, userCount, insightCount, predictionCount] = await Promise.all([
            this.prisma.event.count(),
            this.prisma.errorLog.count(),
            this.prisma.user.count(),
            this.prisma.insight.count(),
            this.prisma.prediction.count(),
        ]);

        return {
            eventCount,
            errorCount,
            userCount,
            insightCount,
            predictionCount,
        };
    }

    async setConfig(key: string, value: string) {
        return await this.prisma.config.upsert({
            where: { key },
            update: { value },
            create: { key, value },
        });
    }

    async getConfig(key: string): Promise<string | null> {
        const config = await this.prisma.config.findUnique({
            where: { key },
        });
        return config ? config.value : null;
    }

    // --- Label Management ---

    async saveLabel(address: string, name: string) {
        return await this.prisma.label.upsert({
            where: { address: address.toLowerCase() },
            update: { name },
            create: { address: address.toLowerCase(), name },
        });
    }

    async getLabel(address: string): Promise<string | null> {
        const label = await this.prisma.label.findUnique({
            where: { address: address.toLowerCase() },
        });
        return label ? label.name : null;
    }

    async getAllLabels() {
        return await this.prisma.label.findMany({
            orderBy: { name: 'asc' },
        });
    }

    // --- AI Usage Tracking ---

    async getDailyAiUsage(): Promise<number> {
        const today = new Date().toISOString().split('T')[0];
        const stats = await this.prisma.dailyStats.findUnique({
            where: { date: today },
        });
        return stats ? stats.aiCalls : 0;
    }

    async incrementAiUsage() {
        const today = new Date().toISOString().split('T')[0];
        return await this.prisma.dailyStats.upsert({
            where: { date: today },
            update: { aiCalls: { increment: 1 } },
            create: { date: today, aiCalls: 1 },
        });
    }

    // --- Insights ---

    async saveInsight(data: { type: string, title: string, content: string, score?: number }) {
        return await this.prisma.insight.create({
            data
        });
    }

    async getLatestInsights(limit = 20) {
        return await this.prisma.insight.findMany({
            orderBy: { timestamp: 'desc' },
            take: limit
        });
    }

    // --- Predictions ---

    async savePrediction(data: { title: string, description: string, probability: number, rationale: string, targetDate: Date }) {
        return await this.prisma.prediction.create({
            data
        });
    }

    async getPredictions(status?: string) {
        return await this.prisma.prediction.findMany({
            where: status ? { status } : {},
            orderBy: { timestamp: 'desc' }
        });
    }

    async updatePrediction(id: number, data: { status: string, actualOutcome?: string, evaluationDate?: Date }) {
        return await this.prisma.prediction.update({
            where: { id },
            data
        });
    }

    // --- Jobs ---

    async getJobs() {
        return await this.prisma.job.findMany({
            where: { active: true }
        });
    }

    async updateJob(id: number, data: any) {
        return await this.prisma.job.update({
            where: { id },
            data
        });
    }
}
