import fs from 'fs';
import path from 'path';
import { MemoryStore, MemoryCategory } from './memoryStore';

export class MemorySearch {
    private store: MemoryStore;
    private baseDir: string;

    constructor(store: MemoryStore) {
        this.store = store;
        this.baseDir = path.join(process.cwd(), 'memory');
    }

    public async search(query: string): Promise<string[]> {
        const keywords = query.toLowerCase().split(/\s+/).filter(k => k.length > 2);
        if (keywords.length === 0) return [];

        const results: { text: string; score: number }[] = [];
        const categories: MemoryCategory[] = ['admin', 'events', 'contracts', 'rules', 'insights'];

        for (const cat of categories) {
            const files = await this.store.listFiles(cat);
            for (const file of files) {
                const content = await this.store.read(cat, file);
                const lines = content.split('\n');

                for (const line of lines) {
                    if (line.trim() === '' || line.startsWith('#')) continue;

                    let score = 0;
                    const lowerLine = line.toLowerCase();

                    for (const kw of keywords) {
                        if (lowerLine.includes(kw)) {
                            score += 1;
                        }
                    }

                    if (score > 0) {
                        results.push({ text: `[${cat}/${file}] ${line}`, score });
                    }
                }
            }
        }

        return results
            .sort((a, b) => b.score - a.score)
            .slice(0, 10)
            .map(r => r.text);
    }
}
