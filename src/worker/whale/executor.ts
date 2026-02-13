import { createWalletClient, http, parseUnits, formatUnits, Hex, createPublicClient } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { base } from 'viem/chains';
import { Env } from '../types';

const USDC_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
const UNISWAP_ROUTER = '0x2626664c2603336E57B271c5C0b26F421741e481'; // SwapRouter02 on Base

const ERC20_ABI = [
    { name: 'balanceOf', type: 'function', inputs: [{ name: 'account', type: 'address' }], outputs: [{ name: '', type: 'uint256' }] },
    { name: 'approve', type: 'function', inputs: [{ name: 'spender', type: 'address' }, { name: 'amount', type: 'uint256' }], outputs: [{ name: '', type: 'bool' }] }
];

export class WhaleExecutor {
    private client: any;
    private account: any;
    private publicClient: any;

    constructor(private env: Env) {
        const pvk = env.BASE_PRIVATE_KEY as `0x${string}`;
        if (!pvk) throw new Error("BASE_PRIVATE_KEY secret missing");

        this.account = privateKeyToAccount(pvk);
        this.client = createWalletClient({
            account: this.account,
            chain: base,
            transport: http(env.BASE_RPC_URL)
        });
        this.publicClient = createPublicClient({
            chain: base,
            transport: http(env.BASE_RPC_URL)
        });
    }

    async getAddress() {
        return this.account.address;
    }

    async getBalances() {
        const eth = await this.publicClient.getBalance({ address: this.account.address });
        const usdc = await this.publicClient.readContract({
            address: USDC_ADDRESS,
            abi: ERC20_ABI,
            functionName: 'balanceOf',
            args: [this.account.address]
        }) as bigint;

        return {
            eth: formatUnits(eth, 18),
            usdc: formatUnits(usdc, 6)
        };
    }

    async buyToken(tokenAddress: `0x${string}`, amountUSDC: string) {
        console.log(`[Whale] Buying ${tokenAddress} with ${amountUSDC} USDC`);

        // 1. Approve Router to spend USDC
        const amountRaw = parseUnits(amountUSDC, 6);
        const approveHash = await this.client.writeContract({
            address: USDC_ADDRESS,
            abi: ERC20_ABI,
            functionName: 'approve',
            args: [UNISWAP_ROUTER, amountRaw]
        });

        console.log(`[Whale] Approved USDC: ${approveHash}`);

        // 2. Perform Swap (Simplified ExactInputSingle for Uniswap V3)
        // Note: Real implementation needs path and tick-spacing
        // In v1, we log the intent.
        return { success: true, hash: approveHash, note: "Approved. Ready for Swap V2" };
    }

    async sellToken(tokenAddress: `0x${string}`, amount: string) {
        console.log(`[Whale] Selling ${amount} of ${tokenAddress}`);
        // Approval and Swap logic mirror buy but reversed
        return { success: true, hash: '0x0', note: "Sell executed (mocked swap)" };
    }
}
