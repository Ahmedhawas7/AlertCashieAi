import { createPublicClient, http, formatUnits, parseUnits, verifyMessage, isAddress } from 'viem';
import { base } from 'viem/chains';
import { Env } from '../types';

export const BASE_USDC_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';

// Official Base Builder Attribution (ERC-7761)
export const BASE_BUILDER_CODE = 'bc_s4ho9ei8';
export const BASE_BUILDER_ENCODED = '0x62635f7334686f396569380b0080218021802180218021802180218021';

/**
 * Appends the Base Builder Code suffix to calldata for rewards eligibility & onchain attribution
 */
export function appendBuilderCode(calldata?: string): string {
    const suffix = BASE_BUILDER_ENCODED.slice(2); // strip 0x
    if (!calldata || calldata === '0x' || calldata === '') {
        return BASE_BUILDER_ENCODED;
    }
    const cleanData = calldata.startsWith('0x') ? calldata : `0x${calldata}`;
    return `${cleanData}${suffix}`;
}

export interface BaseConnection {
    telegram_user_id: string;
    wallet_address: string;
    chain_id: number;
    signature: string;
    message: string;
    linked_at: number;
    updated_at: number;
}

export interface BaseBalances {
    wallet: string;
    eth: string;
    usdc: string;
    ethUsdValue?: number;
}

export interface ExecutionPlan {
    id: number;
    userId: string;
    type: 'transfer' | 'withdraw' | 'swap';
    token: string;
    amount: string;
    recipient: string;
    estimatedGasEth: string;
    estimatedGasUsd: string;
    status: 'pending' | 'executed' | 'cancelled' | 'failed';
    txHash?: string;
    createdAt: number;
}

export function buildSovereignMessage(telegramUserId: string, nonce: string): string {
    return `HAWAS×Agent Base Sovereign Authentication\nTelegram User ID: ${telegramUserId}\nChain ID: 8453 (Base Mainnet)\nNonce: ${nonce}\n\nSign this message to link your Base wallet to your Hawas Agent.\nThis signature is completely free and does NOT authorize any unapproved transactions.`;
}

export class BaseService {
    private client: any;

    constructor(private db: D1Database, private env: Env) {
        this.client = createPublicClient({
            chain: base,
            transport: http(env.BASE_RPC_URL || 'https://mainnet.base.org')
        });
    }

    /**
     * Generate SIWE-compliant challenge message and nonce
     */
    async generateNonce(telegramUserId: string): Promise<{ nonce: string; message: string; expiresAt: number }> {
        const nonce = crypto.randomUUID().replace(/-/g, '');
        const expiresAt = Date.now() + 15 * 60 * 1000; // 15 mins
        const message = buildSovereignMessage(telegramUserId, nonce);

        await this.db.prepare(`
            INSERT INTO base_pending_sessions (nonce, telegram_user_id, created_at, expires_at)
            VALUES (?, ?, ?, ?)
        `).bind(nonce, telegramUserId, Date.now(), expiresAt).run();

        return { nonce, message, expiresAt };
    }

    /**
     * Verify signature and link Base wallet
     */
    async verifyAndLink(telegramUserId: string, walletAddress: string, signature: string, nonce: string): Promise<{ success: boolean; error?: string }> {
        if (!isAddress(walletAddress)) {
            return { success: false, error: 'عنوان المحفظة غير صالح' };
        }

        // Validate nonce session
        const session = await this.db.prepare(`
            SELECT telegram_user_id, expires_at FROM base_pending_sessions WHERE nonce = ?
        `).bind(nonce).first<{ telegram_user_id: string; expires_at: number }>();

        if (!session) {
            return { success: false, error: 'جلسة الربط غير صالحة أو منتهية الصلاحية. يرجى المحاولة مجدداً.' };
        }

        if (Date.now() > session.expires_at) {
            await this.db.prepare(`DELETE FROM base_pending_sessions WHERE nonce = ?`).bind(nonce).run();
            return { success: false, error: 'انتهت صلاحية جلسة الربط، يرجى المحاولة مجدداً' };
        }

        if (String(session.telegram_user_id) !== String(telegramUserId)) {
            return { success: false, error: 'رمز الجلسة لا يتطابق مع معرف المستخدم' };
        }

        const expectedMessage = buildSovereignMessage(telegramUserId, nonce);

        // 1. Verify cryptographic signature with viem (ECDSA / EIP-191)
        let isValid = false;
        try {
            isValid = await verifyMessage({
                address: walletAddress as `0x${string}`,
                message: expectedMessage,
                signature: signature as `0x${string}`
            });
        } catch (e) {
            console.warn('verifyMessage ECDSA error:', e);
        }

        // 2. Fallback check with public client (handles ERC-1271 Smart Contract Wallets / Coinbase Smart Wallet)
        if (!isValid) {
            try {
                isValid = await this.client.verifyMessage({
                    address: walletAddress as `0x${string}`,
                    message: expectedMessage,
                    signature: signature as `0x${string}`
                });
            } catch (e) {
                console.warn('publicClient.verifyMessage ERC-1271 error:', e);
            }
        }

        if (!isValid) {
            return { success: false, error: 'فشل التحقق التشفيري من التوقيع. تأكد من أنك قمت بالتوقيع بالمحفظة المتصلة.' };
        }

        // Clean up session nonce
        await this.db.prepare(`DELETE FROM base_pending_sessions WHERE nonce = ?`).bind(nonce).run();

        const now = Date.now();
        await this.db.prepare(`
            INSERT INTO base_connections (telegram_user_id, wallet_address, chain_id, signature, message, linked_at, updated_at)
            VALUES (?, ?, 8453, ?, ?, ?, ?)
            ON CONFLICT(telegram_user_id) DO UPDATE SET
            wallet_address = excluded.wallet_address,
            signature = excluded.signature,
            message = excluded.message,
            updated_at = excluded.updated_at
        `).bind(String(telegramUserId), walletAddress.toLowerCase(), signature, expectedMessage, now, now).run();

        return { success: true };
    }

    /**
     * Get linked Base wallet
     */
    async getConnection(telegramUserId: string): Promise<BaseConnection | null> {
        return await this.db.prepare(`
            SELECT * FROM base_connections WHERE telegram_user_id = ?
        `).bind(telegramUserId).first<BaseConnection>();
    }

    /**
     * Fetch real on-chain balances on Base Mainnet
     */
    async getBalances(walletAddress: string): Promise<BaseBalances> {
        if (!isAddress(walletAddress)) {
            return { wallet: walletAddress, eth: '0', usdc: '0' };
        }

        const addr = walletAddress as `0x${string}`;

        // 1. Native ETH balance
        const ethRaw = await this.client.getBalance({ address: addr }).catch(() => 0n);

        // 2. USDC ERC-20 balance on Base
        const usdcRaw = await this.client.readContract({
            address: BASE_USDC_ADDRESS,
            abi: [{
                name: 'balanceOf',
                type: 'function',
                stateMutability: 'view',
                inputs: [{ name: 'account', type: 'address' }],
                outputs: [{ name: '', type: 'uint256' }]
            }],
            functionName: 'balanceOf',
            args: [addr]
        }).catch(() => 0n) as bigint;

        return {
            wallet: walletAddress,
            eth: parseFloat(formatUnits(ethRaw, 18)).toFixed(5),
            usdc: parseFloat(formatUnits(usdcRaw, 6)).toFixed(2)
        };
    }

    /**
     * Create Guarded Execution Plan requiring Owner Approval
     */
    async createPlan(
        userId: string,
        type: 'transfer' | 'withdraw' | 'swap',
        token: string,
        amount: string,
        recipient: string
    ): Promise<ExecutionPlan> {
        const estimatedGasEth = '0.000003';
        const estimatedGasUsd = '$0.007'; // Low Base fees

        const now = Date.now();
        const calldata = appendBuilderCode('');
        const res = await this.db.prepare(`
            INSERT INTO pending_tx (user_id, recipient, token, amount, data, status, created_at)
            VALUES (?, ?, ?, ?, ?, 'pending', ?)
        `).bind(userId, recipient, token.toUpperCase(), amount, JSON.stringify({ type, estimatedGasEth, estimatedGasUsd, builderCode: BASE_BUILDER_CODE, calldata }), now).run();

        const planId = (res.meta as any).last_row_id || 1;

        return {
            id: planId,
            userId,
            type,
            token: token.toUpperCase(),
            amount,
            recipient,
            estimatedGasEth,
            estimatedGasUsd,
            status: 'pending',
            createdAt: now
        };
    }

    /**
     * Format Human-friendly Plan message for Telegram
     */
    formatPlanMessage(plan: ExecutionPlan, walletAddress?: string): { text: string; replyMarkup: any } {
        const actionLabel = plan.type === 'transfer' ? 'تحويل أصول' : plan.type === 'withdraw' ? 'سحب رصيد' : 'مبادلة/تداول';
        const shortAddr = plan.recipient.length > 12 ? `${plan.recipient.slice(0, 6)}...${plan.recipient.slice(-4)}` : plan.recipient;

        const text = 
`🛡️ <b>خطة معاملة جديدة على شبكة Base (بانتظار موافقتك)</b>

📋 <b>تفاصيل الخطة:</b>
• <b>نوع العملية:</b> ${actionLabel}
• <b>العملة:</b> <code>${plan.token}</code>
• <b>الكمية:</b> <b>${plan.amount} ${plan.token}</b>
• <b>المستلم:</b> <code>${shortAddr}</code>
• <b>رسوم شبكة Base:</b> ~${plan.estimatedGasEth} ETH (${plan.estimatedGasUsd}) ⚡
• <b>الشبكة:</b> Base Mainnet (Chain ID 8453)
• <b>كود مطور Base:</b> <code>${BASE_BUILDER_CODE}</code> 🏅 (مؤهل لجوائز Base)
${walletAddress ? `• <b>محفظتك:</b> <code>${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}</code>\n` : ''}
⚠️ <b>حماية أمان سيادية:</b>
لن يتم إرسال أي معاملة على البلوكتشين دون ضغط زر الموافقة الصريحة أدناه.`;

        const replyMarkup = {
            inline_keyboard: [
                [
                    { text: '✅ موافقة وتأكيد التنفيذ', callback_data: `tx_confirm:${plan.id}` },
                    { text: '❌ إلغاء المعاملة', callback_data: `tx_cancel:${plan.id}` }
                ]
            ]
        };

        return { text, replyMarkup };
    }
}
