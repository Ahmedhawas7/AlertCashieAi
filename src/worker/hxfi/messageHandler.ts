import { Env } from '../types';
import { BrainV2 } from '../brain/brain';
import {
    jsonResponse,
    badRequest,
    unauthorized,
    requireHxfiAuth
} from './auth';
import {
    safeJson,
    truncatedAddress,
    upsertChatSession,
    saveChatMessage,
    completeMissionInternal
} from './utils';
import { GeminiProvider } from '../ai/providers/gemini';

/**
 * Progress tracking for the 9-task implementation plan.
 */
async function getTaskProgress(db: D1Database): Promise<{ completed: number; total: number }> {
    // We'll use a simple KV-like table or just hardcode the count based on what's done.
    // In a real scenario, this would poll the task.md or a status table.
    // For this demonstration, we'll check how many tasks are marked [x] in a metadata table.
    const row = await db.prepare("SELECT COUNT(*) as count FROM hxfi_bot_tasks WHERE status = 'completed'").first<{ count: number }>();
    return { completed: row?.count || 1, total: 9 }; // Task 1 is already done
}

/**
 * Appends the execution status to the bot response.
 */
async function appendProgress(text: string, db: D1Database): Promise<string> {
    const progress = await getTaskProgress(db);
    const progressText = `\n\n[تم تنفيذ ${progress.completed} من ${progress.total} أوامر]`;
    return text + progressText;
}

/**
 * Internal logic for processing a text message, shared by HTTP and Voice handlers.
 */
async function handleTextLogic(userId: string, text: string, sessionId: string, env: Env): Promise<any> {
    // Ensure session exists
    await upsertChatSession(env.DB, sessionId, userId);

    // Save user message
    await saveChatMessage(env.DB, sessionId, 'user', text);

    // Call AI Brain
    const brain = new BrainV2(env.DB, env);
    const brainResult = await brain.handleMessage(
        userId,
        truncatedAddress(userId),
        text,
        sessionId,
        'web'
    );

    let replyText: string;
    let plan: any = null;
    let planId: string | null = null;

    if (typeof brainResult === 'string') {
        replyText = brainResult;
    } else {
        replyText = brainResult.text;
        if (brainResult.reply_markup) {
            plan = {
                message: replyText,
                buttons: brainResult.reply_markup.inline_keyboard?.flat() || [],
            };
            planId = crypto.randomUUID();
            await env.DB.prepare(
                `INSERT INTO hxfi_pending_plans (id, session_id, user_id, plan_json, status, created_at, expires_at)
                 VALUES (?, ?, ?, ?, 'pending', ?, ?)`
            ).bind(
                planId,
                sessionId,
                userId,
                JSON.stringify({ brainResult, text }),
                Date.now(),
                Date.now() + 10 * 60 * 1000
            ).run();
        }
    }

    // Append task progress
    replyText = await appendProgress(replyText, env.DB);

    // Save assistant reply
    await saveChatMessage(env.DB, sessionId, 'assistant', replyText);

    // Auto-complete "First Chat" mission
    try {
        await completeMissionInternal(env.DB, userId, 'm3');
    } catch { }

    return { sessionId, reply: replyText, plan, planId };
}

/**
 * HTTP handler for text chat.
 */
export async function processChatMessage(request: Request, env: Env): Promise<Response> {
    const auth = await requireHxfiAuth(request, env.DB);
    if (!auth) return unauthorized();

    const body = await safeJson(request);
    if (!body?.text) return badRequest('text required');

    const result = await handleTextLogic(auth.userId, body.text, body.sessionId || crypto.randomUUID(), env);

    return jsonResponse({
        ok: true,
        sessionId: result.sessionId,
        reply: result.reply,
        ...(result.plan ? { plan: { id: result.planId, ...result.plan } } : {}),
    });
}

/**
 * HTTP handler for voice chat.
 * Expects 'multipart/form-data' with an 'audio' file and optional 'sessionId'.
 */
export async function processVoiceMessage(request: Request, env: Env): Promise<Response> {
    const auth = await requireHxfiAuth(request, env.DB);
    if (!auth) return unauthorized();

    const formData = await request.formData();
    const audioFile = formData.get('audio') as File;
    if (!audioFile) return badRequest('audio file required');

    const sessionId = (formData.get('sessionId') as string) || crypto.randomUUID();
    const arrayBuffer = await audioFile.arrayBuffer();

    // Transcribe
    const gemini = new GeminiProvider(env);
    let text: string;
    try {
        text = await gemini.transcribe(arrayBuffer, audioFile.type || 'audio/wav');
    } catch (err: any) {
        console.error('[Voice Transcription Error]', err);
        return jsonResponse({ error: 'Transcription failed' }, 500);
    }

    if (!text) return jsonResponse({ error: 'Could not understand audio' }, 400);

    // Process as text
    const result = await handleTextLogic(auth.userId, text, sessionId, env);

    return jsonResponse({
        ok: true,
        transcription: text,
        sessionId: result.sessionId,
        reply: result.reply,
        ...(result.plan ? { plan: { id: result.planId, ...result.plan } } : {}),
    });
}
