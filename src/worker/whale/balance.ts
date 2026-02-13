import { createPublicClient, http, formatUnits } from 'viem';
import { base } from 'viem/chains';
import { Env } from '../types';

const USDC_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';

export class WhaleBalance {
    private client: any;

    constructor(env: Env) {
        this.client = createPublicClient({
            chain: base,
            transport: http(env.BASE_RPC_URL || 'https://mainnet.base.org')
        });
    }

    async getBalances(address: `0x${string}`) {
        const ethBalance = await this.client.getBalance({ address });

        const usdcBalance = await this.client.readContract({
            address: USDC_ADDRESS,
            abi: [{
                name: 'balanceOf',
                type: 'function',
                stateMutability: 'view',
                inputs: [{ name: 'account', type: 'address' }],
                outputs: [{ name: '', type: 'uint256' }]
            }],
            functionName: 'balanceOf',
            args: [address]
        }) as bigint;

        return {
            eth: formatUnits(ethBalance, 18),
            usdc: formatUnits(usdcBalance, 6)
        };
    }
}
