import { verifyMessage } from 'viem';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { Env } from '../types';

export interface SessionAuthResult {
    success: boolean;
    message?: string;
    walletAddress?: string;
    sessionPublicKey?: string;
    sessionPrivateKey?: string;
}

/**
 * Session Authorization Flow
 */
export class SessionAuth {
    /**
     * Generate the message for the user to sign
     */
    static generateAuthMessage(sessionAddress: string, userId: string): string {
        const expiry = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
        return `Authorize Session Agent
Agent: hawas-agent
User ID: ${userId}
Session Public Key: ${sessionAddress}
Permissions:
- transfer USDC
- max daily limit: 100 USDC
- network: Base
- expiry: ${expiry}`.trim();
    }

    /**
     * Create a new ephemeral session signer
     */
    static createSessionSigner() {
        const privateKey = generatePrivateKey();
        const account = privateKeyToAccount(privateKey);
        return {
            privateKey,
            address: account.address
        };
    }

    /**
     * Verify the signature from the user
     */
    static async verifySignature(
        message: string,
        signature: `0x${string}`,
        address: `0x${string}`
    ): Promise<boolean> {
        return await verifyMessage({
            address,
            message,
            signature
        });
    }
}
