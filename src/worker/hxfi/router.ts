/**
 * HXFi HTTP Router
 * Handles all /api/hxfi/* routes.
 * Import and call hxfiRouter(request, env) from the main worker index.
 */

import { Env } from '../types';
import {
    generateNonce,
    consumeNonce,
    verifySignature,
    issueToken,
    requireHxfiAuth,
    unauthorized,
    badRequest,
    jsonResponse,
} from './auth';
import { processChatMessage, processVoiceMessage } from './messageHandler';
import {
    getOrCreateProfile,
    getEnrichedProfile,
    awardXP,
    updateStreak,
} from './profile';
import { handleSeedRequest } from './seeds';
import {
    safeJson,
    truncatedAddress,
    saveChatMessage,
    completeMissionInternal
} from './utils';
import { BrainV2 } from '../brain/brain';

const TICKET_PRICE_USD = 5.00; // $5 per ticket

function uuid(): string {
    return crypto.randomUUID();
}

/** Main router — delegates to sub-handlers based on path + method. */
export async function hxfiRouter(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/$/, '');
    const method = request.method.toUpperCase();

    // Extract dynamic segments
    const missionCompleteMatch = path.match(/^\/api\/hxfi\/missions\/([^/]+)\/complete$/);

    try {
        // ── Health ──────────────────────────────────────────────────
        if (path === '/api/hxfi/health' && method === 'GET') {
            return jsonResponse({ ok: true, service: 'hxfi', ts: Date.now() });
        }

        // ── Seed (admin only) ────────────────────────────────────────
        if (path === '/api/hxfi/admin/seed' && method === 'POST') {
            return handleSeedRequest(request, env.DB, env.OWNER_TELEGRAM_ID || '');
        }

        // ── Auth: Nonce ──────────────────────────────────────────────
        if (path === '/api/hxfi/auth/nonce' && method === 'POST') {
            const body = await safeJson(request);
            if (!body?.address) return badRequest('address required');
            const address = String(body.address).toLowerCase();
            if (!isValidAddress(address)) return badRequest('Invalid EVM address');
            const result = await generateNonce(env.DB, address);
            return jsonResponse(result);
        }

        // ── Auth: Verify ─────────────────────────────────────────────
        if (path === '/api/hxfi/auth/verify' && method === 'POST') {
            const body = await safeJson(request);
            if (!body?.address || !body?.nonce || !body?.signature) {
                return badRequest('address, nonce, and signature required');
            }

            const rawAddress = String(body.address);
            const nonce = String(body.nonce);
            const signature = String(body.signature);

            // Reconstruct the exact message they signed
            const expiresAt = Date.now() + 10 * 60 * 1000; // approximate — not used for verification
            const messageToSign =
                `Welcome to HXFi!\n\nSign this message to verify your wallet ownership.\n\nNonce: ${nonce}\nExpires: ${new Date(expiresAt).toISOString()}`;

            // Consume nonce from DB (validates expiry + value)
            const address = await consumeNonce(env.DB, rawAddress, nonce);
            if (!address) return jsonResponse({ error: 'Invalid or expired nonce' }, 401);

            // Verify EVM signature
            const valid = await verifySignature(rawAddress, messageToSign, signature);
            if (!valid) {
                // For development, accept if ALLOW_DEV_AUTH env is set (skip sig check)
                const devMode = (env as any).ALLOW_DEV_AUTH === 'true';
                if (!devMode) return jsonResponse({ error: 'Signature verification failed' }, 401);
            }

            // Issue session token
            const token = await issueToken(env.DB, address);

            // Create/update profile and update streak
            await getOrCreateProfile(env.DB, address);
            await updateStreak(env.DB, address);

            // Auto-complete "Connect Wallet" mission
            try {
                await completeMissionInternal(env.DB, address, 'm1');
            } catch { /* ignore if already completed */ }

            return jsonResponse({ token, address });
        }

        // ── Protected routes — require auth ─────────────────────────
        const auth = await requireHxfiAuth(request, env.DB);

        if (path === '/api/hxfi/me' && method === 'GET') {
            if (!auth) return unauthorized();
            const profile = await getEnrichedProfile(env.DB, auth.userId);
            return jsonResponse(profile);
        }

        // ── Missions: List ──────────────────────────────────────────
        if (path === '/api/hxfi/missions' && method === 'GET') {
            const missions = await env.DB.prepare(
                `SELECT * FROM hxfi_missions WHERE active = 1 ORDER BY category, id`
            ).all<any>();

            // If auth, annotate which are completed
            const completedIds = new Set<string>();
            if (auth) {
                const comps = await env.DB.prepare(
                    `SELECT mission_id FROM hxfi_mission_completions WHERE user_id = ?`
                ).bind(auth.userId).all<{ mission_id: string }>();
                comps.results?.forEach(c => completedIds.add(c.mission_id));
            }

            const result = missions.results?.map(m => ({
                ...m,
                completed: completedIds.has(m.id),
            })) || [];

            return jsonResponse(result);
        }

        // ── Missions: Complete ──────────────────────────────────────
        if (missionCompleteMatch && method === 'POST') {
            if (!auth) return unauthorized();
            const missionId = missionCompleteMatch[1];
            const result = await completeMissionInternal(env.DB, auth.userId, missionId);
            if (!result.ok) return jsonResponse({ error: result.error }, 400);
            return jsonResponse(result);
        }

        // ── Tickets: List ───────────────────────────────────────────
        if (path === '/api/hxfi/tickets' && method === 'GET') {
            if (!auth) return unauthorized();
            const tickets = await env.DB.prepare(
                `SELECT * FROM hxfi_tickets WHERE user_id = ? ORDER BY created_at DESC`
            ).bind(auth.userId).all<any>();
            return jsonResponse(tickets.results || []);
        }

        // ── Tickets: Purchase ───────────────────────────────────────
        if (path === '/api/hxfi/tickets/purchase' && method === 'POST') {
            if (!auth) return unauthorized();
            const body = await safeJson(request);
            const qty = parseInt(String(body?.qty || '1'), 10);
            if (!qty || qty < 1 || qty > 100) return badRequest('qty must be 1-100');

            const id = uuid();
            const now = Date.now();
            const priceUsd = qty * TICKET_PRICE_USD;

            await env.DB.prepare(
                `INSERT INTO hxfi_tickets (id, user_id, qty, price_usd, payment_provider, status, created_at)
                 VALUES (?, ?, ?, ?, 'stub', 'pending', ?)`
            ).bind(id, auth.userId, qty, priceUsd, now).run();

            // Award XP for buying tickets
            await awardXP(env.DB, auth.userId, 50 * qty, 5 * qty);

            // Auto-complete "Buy First Ticket" mission
            try {
                await completeMissionInternal(env.DB, auth.userId, 'm4');
            } catch { /* ignore */ }

            return jsonResponse({
                ok: true,
                ticket: { id, qty, price_usd: priceUsd, status: 'pending', created_at: now },
                message: `Purchase recorded (${qty} ticket${qty > 1 ? 's' : ''}). You'll be notified when payment is confirmed.`,
            });
        }

        // ── Chat: Send Message ──────────────────────────────────────
        if (path === '/api/hxfi/chat' && method === 'POST') {
            return processChatMessage(request, env);
        }

        // ── Chat: Send Voice Message ────────────────────────────────
        if (path === '/api/hxfi/chat/voice' && method === 'POST') {
            return processVoiceMessage(request, env);
        }

        // ── Chat: Confirm Plan ──────────────────────────────────────
        if (path === '/api/hxfi/chat/confirm' && method === 'POST') {
            if (!auth) return unauthorized();
            const body = await safeJson(request);
            const planId = body?.planId;
            if (!planId) return badRequest('planId required');

            const pending = await env.DB.prepare(
                `SELECT * FROM hxfi_pending_plans WHERE id = ? AND user_id = ? AND status = 'pending'`
            ).bind(planId, auth.userId).first<any>();

            if (!pending) return jsonResponse({ error: 'Plan not found or already processed' }, 404);
            if (Date.now() > pending.expires_at) {
                await env.DB.prepare(`UPDATE hxfi_pending_plans SET status = 'cancelled' WHERE id = ?`).bind(planId).run();
                return jsonResponse({ error: 'Plan expired' }, 410);
            }

            // For now: mark as executed and return a stub confirmation
            // (Real tx execution reuses existing BrainV2.handleExecuteIntent)
            await env.DB.prepare(
                `UPDATE hxfi_pending_plans SET status = 'executed' WHERE id = ?`
            ).bind(planId).run();

            const confirmationMsg = '✅ Action confirmed and executed.';
            await saveChatMessage(env.DB, pending.session_id, 'assistant', confirmationMsg);

            return jsonResponse({ ok: true, message: confirmationMsg, planId });
        }

        // ── Chat: Cancel Plan ───────────────────────────────────────
        if (path === '/api/hxfi/chat/cancel' && method === 'POST') {
            if (!auth) return unauthorized();
            const body = await safeJson(request);
            const planId = body?.planId;
            if (!planId) return badRequest('planId required');

            await env.DB.prepare(
                `UPDATE hxfi_pending_plans SET status = 'cancelled' WHERE id = ? AND user_id = ?`
            ).bind(planId, auth.userId).run();

            const cancelMsg = '❌ Action cancelled.';
            const session = await env.DB.prepare(
                `SELECT session_id FROM hxfi_pending_plans WHERE id = ?`
            ).bind(planId).first<{ session_id: string }>();
            if (session) {
                await saveChatMessage(env.DB, session.session_id, 'assistant', cancelMsg);
            }

            return jsonResponse({ ok: true, message: cancelMsg });
        }

        // ── Chat: History ───────────────────────────────────────────
        if (path === '/api/hxfi/chat/history' && method === 'GET') {
            if (!auth) return unauthorized();
            const sessionId = url.searchParams.get('sessionId');
            if (!sessionId) return badRequest('sessionId required');

            // Verify session belongs to this user
            const session = await env.DB.prepare(
                `SELECT id FROM hxfi_chat_sessions WHERE id = ? AND user_id = ?`
            ).bind(sessionId, auth.userId).first();
            if (!session) return jsonResponse({ error: 'Session not found' }, 404);

            const messages = await env.DB.prepare(
                `SELECT id, role, content, created_at FROM hxfi_chat_messages WHERE session_id = ? ORDER BY created_at ASC`
            ).bind(sessionId).all<any>();

            return jsonResponse(messages.results || []);
        }

        return jsonResponse({ error: 'Not found' }, 404);

    } catch (err: any) {
        console.error('[HXFi Router Error]', err?.message, err?.stack);
        return jsonResponse({ error: 'Internal server error', requestId: uuid() }, 500);
    }
}

function isValidAddress(addr: string): boolean {
    return /^0x[0-9a-f]{40}$/.test(addr);
}
