import fs from 'fs';
import path from 'path';

export type MemoryCategory = 'admin' | 'events' | 'contracts' | 'rules' | 'insights' | 'predictions' | 'knowledge';

export class MemoryStore {
    private baseDir: string;

    constructor() {
        this.baseDir = path.join(process.cwd(), 'memory');
        this.ensureDirectories();
    }

    private ensureDirectories() {
        const categories: MemoryCategory[] = ['admin', 'events', 'contracts', 'rules', 'insights', 'predictions', 'knowledge']; // Added 'knowledge'
        if (!fs.existsSync(this.baseDir)) {
            fs.mkdirSync(this.baseDir);
        }
        categories.forEach(cat => {
            const dir = path.join(this.baseDir, cat);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir);
            }
        });
    }

    private getFilePath(category: MemoryCategory | 'knowledge', filename: string): string {
        const ext = filename.endsWith('.md') ? '' : '.md';
        return path.join(this.baseDir, category, `${filename}${ext}`);
    }

    public async append(category: MemoryCategory | 'knowledge', filename: string, content: string) {
        const filePath = this.getFilePath(category, filename);
        const timestamp = new Date().toISOString();
        const entry = `\n- [${timestamp}] ${content}`;

        await fs.promises.appendFile(filePath, entry, 'utf8');
    }

    public async learn(question: string, answer: string) {
        const filePath = this.getFilePath('knowledge', 'kb.md');

        // Ensure file exists
        if (!fs.existsSync(filePath)) {
            await fs.promises.writeFile(filePath, '# Knowledge Base\n\n');
        }

        const content = await fs.promises.readFile(filePath, 'utf8');

        // Simple deduplication check
        if (content.includes(`Q: ${question}`)) {
            return false; // Duplicate
        }

        // Cairo Timestamp
        const timestamp = new Date().toLocaleString('en-US', { timeZone: 'Africa/Cairo' });

        const entry = `
### Q: ${question}
**A**: ${answer}
*Learned: ${timestamp} (Cairo)*
---`;

        await fs.promises.appendFile(filePath, entry, 'utf8');
        return true;
    }

    public async read(category: MemoryCategory | 'knowledge', filename: string): Promise<string> {
        const filePath = this.getFilePath(category, filename);
        if (!fs.existsSync(filePath)) return '';
        return await fs.promises.readFile(filePath, 'utf8');
    }

    public async listFiles(category: MemoryCategory | 'knowledge'): Promise<string[]> {
        const dir = path.join(this.baseDir, category);
        if (!fs.existsSync(dir)) return [];
        return await fs.promises.readdir(dir);
    }

    public async markDeprecated(category: MemoryCategory | 'knowledge', filename: string, keyword: string) {
        const filePath = this.getFilePath(category, filename);
        if (!fs.existsSync(filePath)) return;

        let content = await fs.promises.readFile(filePath, 'utf8');
        const lines = content.split('\n');
        const updatedLines = lines.map(line => {
            if (line.toLowerCase().includes(keyword.toLowerCase()) && !line.includes('[DEPRECATED]')) {
                return line + ' [DEPRECATED]';
            }
            return line;
        });

        await fs.promises.writeFile(filePath, updatedLines.join('\n'), 'utf8');
    }

    public getAllMemoryFiles(): { category: string, files: string[] }[] {
        const categories: (MemoryCategory | 'knowledge')[] = ['admin', 'events', 'contracts', 'rules', 'insights', 'predictions', 'knowledge'];
        return categories.map(cat => ({
            category: cat,
            files: fs.existsSync(path.join(this.baseDir, cat)) ? fs.readdirSync(path.join(this.baseDir, cat)).filter(f => f.endsWith('.md')) : []
        }));
    }
}
