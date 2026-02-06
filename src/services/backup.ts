import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import { Telegraf } from 'telegraf';
import { StorageService } from './storage';

export class BackupService {
    private bot: Telegraf;
    private storage: StorageService;
    private backupDir: string;

    constructor(bot: Telegraf, storage: StorageService) {
        this.bot = bot;
        this.storage = storage;
        this.backupDir = path.join(process.cwd(), 'backups');
        if (!fs.existsSync(this.backupDir)) {
            fs.mkdirSync(this.backupDir);
        }
    }

    public async performBackup() {
        const dbUrl = process.env.DATABASE_URL || 'file:./prisma/dev.db';
        const dbPath = path.resolve(process.cwd(), dbUrl.replace('file:', ''));

        if (!fs.existsSync(dbPath)) {
            console.error(`Database not found at ${dbPath}`);
            return;
        }

        const dateStr = new Date().toISOString().split('T')[0];
        const backupPath = path.join(this.backupDir, `backup-${dateStr}.sqlite.gz`);

        try {
            console.log(`💾 Backing up database to ${backupPath}...`);
            const input = fs.createReadStream(dbPath);
            const output = fs.createWriteStream(backupPath);
            const compress = zlib.createGzip();

            await new Promise((resolve, reject) => {
                input.pipe(compress).pipe(output)
                    .on('finish', resolve)
                    .on('error', reject);
            });

            const adminChatId = process.env.TELEGRAM_ADMIN_CHAT_ID || (process.env.TELEGRAM_ADMIN_IDS || '').split(',')[0];
            if (adminChatId) {
                await this.bot.telegram.sendDocument(adminChatId, { source: backupPath }, {
                    caption: `💾 *Database Backup (${dateStr})*\nStatus: Healthy\nSize: ${(fs.statSync(backupPath).size / 1024).toFixed(2)} KB`,
                    parse_mode: 'Markdown'
                });
                console.log('✅ Backup sent to Telegram.');
            }

            this.cleanupOldBackups();
        } catch (e) {
            console.error('Backup failed:', (e as any).message);
            await this.storage.logError('Backup failed', (e as any).stack);
        }
    }

    private cleanupOldBackups(keepN = 7) {
        const files = fs.readdirSync(this.backupDir)
            .filter(f => f.startsWith('backup-') && f.endsWith('.sqlite.gz'))
            .sort((a, b) => fs.statSync(path.join(this.backupDir, b)).mtimeMs - fs.statSync(path.join(this.backupDir, a)).mtimeMs);

        if (files.length > keepN) {
            files.slice(keepN).forEach(f => {
                fs.unlinkSync(path.join(this.backupDir, f));
                console.log(`🗑 Deleted old backup: ${f}`);
            });
        }
    }

    public async listBackups() {
        return fs.readdirSync(this.backupDir)
            .filter(f => f.startsWith('backup-') && f.endsWith('.sqlite.gz'))
            .sort((a, b) => fs.statSync(path.join(this.backupDir, b)).mtimeMs - fs.statSync(path.join(this.backupDir, a)).mtimeMs);
    }
}
