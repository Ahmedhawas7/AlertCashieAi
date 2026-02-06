import { createPublicClient, http, PublicClient } from 'viem';
import { base } from 'viem/chains';

export class RPCService {
    private client: any;

    constructor(rpcUrl: string) {
        this.client = createPublicClient({
            chain: base,
            transport: http(rpcUrl),
        });
    }

    async getLatestBlock() {
        return await this.retry(() => this.client.getBlockNumber());
    }

    async getLogs(params: any) {
        return await this.retry(() => this.client.getLogs(params));
    }

    async getTransactionReceipt(hash: `0x${string}`) {
        return await this.retry(() => this.client.getTransactionReceipt({ hash }));
    }

    private async retry<T>(fn: () => Promise<T>, retries = 3, delay = 1000): Promise<T> {
        try {
            return await fn();
        } catch (error) {
            if (retries > 0) {
                await new Promise((resolve) => setTimeout(resolve, delay));
                return this.retry(fn, retries - 1, delay * 2);
            }
            throw error;
        }
    }
}
