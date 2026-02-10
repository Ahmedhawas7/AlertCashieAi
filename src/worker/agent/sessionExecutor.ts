import { createWalletClient, http, encodeFunctionData, parseUnits, Hash } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { base } from 'viem/chains';
import { Env } from '../types';

export interface TxResult {
    success: boolean;
    hash?: Hash;
    error?: string;
}

const ERC20_ABI = [
    {
        name: 'transfer',
        type: 'function',
        stateMutability: 'nonpayable',
        inputs: [
            { name: 'recipient', type: 'address' },
            { name: 'amount', type: 'uint256' }
        ],
        outputs: [{ name: '', type: 'bool' }]
    }
] as const;

/**
 * Session Execution Engine for Base Network
 */
export class SessionExecutor {
    private env: Env;
    private rpcUrl: string;

    constructor(env: Env) {
        this.env = env;
        this.rpcUrl = env.BASE_RPC_URL || 'https://mainnet.base.org';
    }

    /**
     * Execute a transfer transaction using a session signer
     */
    async executeTransfer(
        sessionPrivateKey: `0x${string}`,
        to: `0x${string}`,
        amount: string,
        tokenAddress: `0x${string}`,
        tokenSymbol: string
    ): Promise<TxResult> {
        try {
            const account = privateKeyToAccount(sessionPrivateKey);
            const client = createWalletClient({
                account,
                chain: base,
                transport: http(this.rpcUrl)
            });

            let hash: Hash;

            if (tokenSymbol === 'ETH') {
                hash = await client.sendTransaction({
                    to,
                    value: parseUnits(amount, 18),
                    kzg: undefined // Base doesn't need KZG for standard transfers
                } as any);
            } else {
                // ERC20 Transfer
                const data = encodeFunctionData({
                    abi: ERC20_ABI,
                    functionName: 'transfer',
                    args: [to, parseUnits(amount, 6)] // Assuming USDC (6 decimals)
                });

                hash = await client.sendTransaction({
                    to: tokenAddress,
                    data,
                    kzg: undefined
                } as any);
            }

            return { success: true, hash };
        } catch (err: any) {
            console.error('Execution Error:', err);
            return { success: false, error: err.message };
        }
    }
}
