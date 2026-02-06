import fetch from 'node-fetch';
import { StorageService } from '../services/storage';
import { EventType } from '../services/classifier';

export class GitHubWatcher {
    private storage: StorageService;
    private org: string = 'carv-protocol';
    private repos: string[] = ['carv-protocol-docs', 'protocol-contracts', 'carv-node'];
    private lastEtag: Record<string, string> = {};

    constructor(storage: StorageService) {
        this.storage = storage;
    }

    async poll() {
        const isPaused = (await this.storage.getConfig('watchers_paused')) === 'true';
        if (isPaused) return;

        console.log('Polling GitHub events...');

        for (const repo of this.repos) {
            try {
                await this.pollCommits(repo);
                await this.pollReleases(repo);
            } catch (e) {
                await this.storage.logError(`GitHub poll failed for ${repo}`, (e as any).stack);
            }
        }
    }

    private async pollCommits(repo: string) {
        const url = `https://api.github.com/repos/${this.org}/${repo}/commits?per_page=5`;
        const response = await fetch(url, {
            headers: { 'User-Agent': 'AlertCashie-Bot' }
        });

        if (response.status !== 200) return;

        const commits = await response.json() as any[];
        const latest = commits[0];

        if (!latest) return;

        const stateKey = `github_commits_${repo}`;
        const state = await this.storage.getWatcherState(stateKey);

        if (state?.lastSeen !== latest.sha) {
            await this.storage.saveEvent({
                source: 'GitHub',
                type: EventType.DevUpdate,
                severity: 'info',
                title: `🔨 Dev update in ${repo}`,
                summary: `New commit: ${latest.commit.message.split('\n')[0]}`,
                details: `Author: ${latest.commit.author.name}\nSHA: ${latest.sha}`,
                sourceUrl: latest.html_url,
                tags: JSON.stringify(['dev', repo]),
                entities: JSON.stringify({}),
                rawRef: `gh_commit_${latest.sha}`
            });

            await this.storage.updateWatcherState(stateKey, { lastSeen: latest.sha });
        }
    }

    private async pollReleases(repo: string) {
        const url = `https://api.github.com/repos/${this.org}/${repo}/releases/latest`;
        const response = await fetch(url, {
            headers: { 'User-Agent': 'AlertCashie-Bot' }
        });

        if (response.status !== 200) return;

        const release = await response.json() as any;
        const stateKey = `github_release_${repo}`;
        const state = await this.storage.getWatcherState(stateKey);

        if (state?.lastSeen !== release.id.toString()) {
            await this.storage.saveEvent({
                source: 'GitHub',
                type: EventType.DevUpdate,
                severity: 'high',
                title: `🚀 New Release: ${repo} ${release.tag_name}`,
                summary: release.name || 'New version shipped!',
                details: release.body?.slice(0, 500) || '',
                sourceUrl: release.html_url,
                tags: JSON.stringify(['release', repo]),
                entities: JSON.stringify({}),
                rawRef: `gh_release_${release.id}`
            });

            await this.storage.updateWatcherState(stateKey, { lastSeen: release.id.toString() });
        }
    }
}
