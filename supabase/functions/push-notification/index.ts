import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import {
    getFcmAccessToken,
    selectDeliveryTokens,
    buildFcmPayload,
    sendFcmMessage,
    sendFcmMessageWithRetry,
    classifyFcmResult,
    pruneInvalidTokens,
    PushTokenRecord
} from "../_shared/fcm.ts";

/**
 * Supabase Edge Function: push-notification (v35 - SSOT)
 * 
 * Triggered by:
 * 1) Database Webhook (INSERT on public.notifications with status='queued')
 * 2) Direct RPC / Function Invoke
 */

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Firebase Settings (Supabase Dashboard Secrets)
const FIREBASE_PROJECT_ID = Deno.env.get('FIREBASE_PROJECT_ID') || '';
const FIREBASE_CLIENT_EMAIL = Deno.env.get('FIREBASE_CLIENT_EMAIL') || '';
const FIREBASE_PRIVATE_KEY = Deno.env.get('FIREBASE_PRIVATE_KEY') || '';

// Supabase Settings
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('RAON_SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const payload = await req.json();
        console.log("[Push Notification] Received payload:", JSON.stringify(payload));

        // 0. Retry Sweep Mode (invoked by cron or retry worker)
        if (payload?.mode === 'retry-sweep' || payload?.action === 'retry-sweep') {
            console.log("[Push Notification] Running retry sweep cycle...");
            const sweepResult = await executeRetrySweep();
            return new Response(JSON.stringify(sweepResult), {
                headers: { ...corsHeaders, "Content-Type": "application/json" }
            });
        }

        // 1. Validate Payload (Supabase Webhook format or Direct Invoke)
        const record = payload.record || payload;
        if (!record || !record.user_id || !record.title) {
            throw new Error("Invalid payload format. Expected 'record' with user_id and title.");
        }

        const { id, user_id, title, body, data, event_type, related_id } = record;

        console.log(`[Push Notification] Processing notification id=${id || 'direct'} for user=${user_id}`);

        // 2. Atomic Claim Guard (Prevent duplicate sends if trigger & direct invoke fire simultaneously)
        if (id) {
            const { data: claimed, error: claimErr } = await supabase
                .from('notifications')
                .update({ status: 'sending' })
                .eq('id', id)
                .in('status', ['queued', 'retry'])
                .select('id')
                .maybeSingle();

            if (claimErr) {
                console.warn('[CLAIM WARN]', claimErr.message);
            }
            // If already processed or claimed by another worker, exit cleanly
            if (!claimed && payload.record) {
                console.log(`[CLAIM GUARD] Notification ${id} already processed or in-flight. Skipping duplicate invocation.`);
                return new Response(JSON.stringify({ message: "Already processed or claimed" }), {
                    headers: { ...corsHeaders, "Content-Type": "application/json" }
                });
            }
        }

        // 3. Fetch User's Push Tokens
        const { data: tokensRaw, error: tokenError } = await supabase
            .from('push_tokens')
            .select('token, device_type, last_updated_at')
            .eq('user_id', user_id)
            .eq('is_active', true)
            .order('last_updated_at', { ascending: false });

        if (tokenError) {
            console.error('[TOKEN FETCH ERR]', tokenError);
            throw tokenError;
        }

        const allTokens = (tokensRaw || []) as PushTokenRecord[];

        if (allTokens.length === 0) {
            console.log(`[TOKEN SKIP] No active tokens found for user ${user_id}`);
            if (id) {
                await updateNotificationStatus(id, 'failed', 'No tokens found');
            }
            return new Response(JSON.stringify({ message: "No tokens found" }), {
                headers: { ...corsHeaders, "Content-Type": "application/json" }
            });
        }

        // 4. Device Filtering SSOT (Suppress web tokens if native app token exists)
        const deliveryTokens = selectDeliveryTokens(allTokens);

        // Deduplicate tokens by token string
        const uniqueTokensMap = new Map<string, PushTokenRecord>();
        deliveryTokens.forEach(t => uniqueTokensMap.set(t.token, t));
        const uniqueTokens = Array.from(uniqueTokensMap.values());

        console.log(`[DISPATCH] Sending to ${uniqueTokens.length} unique filtered token(s)...`);

        // 5. Retrieve FCM Access Token
        const accessToken = await getFcmAccessToken(FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY);

        // 6. Build and Send FCM Messages (in chunks of 25)
        const CHUNK_SIZE = 25;
        const results: Array<{ token: string; status: number; resBody: any }> = [];

        // Pure BigTextStyle: Only attach heroImage if explicitly specified in data
        const heroImage = data?.hero_image;

        for (let i = 0; i < uniqueTokens.length; i += CHUNK_SIZE) {
            const chunk = uniqueTokens.slice(i, i + CHUNK_SIZE);
            const chunkResults = await Promise.all(chunk.map(async (t) => {
                const message = buildFcmPayload(t.token, t.device_type, {
                    title: String(title),
                    body: String(body || ''),
                    data: typeof data === 'object' ? data : {},
                    heroImage: heroImage,
                    link: data?.link,
                    eventType: event_type,
                    relatedId: related_id,
                });

                const res = await sendFcmMessageWithRetry(FIREBASE_PROJECT_ID, accessToken, message, 1);
                console.log(`[FCM SEND] Token: ${t.token.slice(0, 15)}... | Device: ${t.device_type || 'web'} | Status: ${res.status} | Outcome: ${res.outcome}`);
                return { token: t.token, status: res.status, resBody: res.resBody, outcome: res.outcome };
            }));

            results.push(...chunkResults);

            if (i + CHUNK_SIZE < uniqueTokens.length) {
                await new Promise(r => setTimeout(r, 50));
            }
        }

        const successCount = results.filter(r => r.status === 200).length;
        console.log(`[FCM FINISHED] Success: ${successCount} / Total: ${results.length}`);

        // 7. Safe Token Pruning (Deletes ONLY confirmed 404 / UNREGISTERED)
        const prunedCount = await pruneInvalidTokens(supabase, results);

        // 8. Determine Final Status based on Selective Retry Architecture
        const hasRetryableFailure = results.some(r => classifyFcmResult(r.status, r.resBody) === 'retry');
        const hasDeadFailure = results.some(r => classifyFcmResult(r.status, r.resBody) === 'dead');

        let finalStatus = 'failed';
        if (successCount > 0) {
            finalStatus = 'sent';
        } else if (hasRetryableFailure) {
            finalStatus = 'retry';
        } else if (hasDeadFailure) {
            finalStatus = 'dead';
        }

        const resultSummary = JSON.stringify(results.map(r => ({
            status: r.status,
            err: r.resBody?.error?.message,
            code: r.resBody?.error?.details?.[0]?.errorCode
        })));

        if (id) {
            const currentAttempt = Number(record.attempt_count || record.data?.attempt_count || 1);
            await updateNotificationStatus(id, finalStatus, resultSummary, data, currentAttempt);
        }

        return new Response(JSON.stringify({
            success: successCount > 0,
            status: finalStatus,
            successCount,
            totalCount: results.length,
            prunedTokens: prunedCount,
        }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });

    } catch (error: any) {
        console.error("[CRITICAL ERROR]", error);
        return new Response(JSON.stringify({ error: error.message }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
});

async function updateNotificationStatus(
    id: string, 
    status: string, 
    resultSummary: string, 
    existingData?: any,
    currentAttempt: number = 1
) {
    const nowIso = new Date().toISOString();
    const updateData: any = {
        status,
        error_message: resultSummary,
        last_attempt_at: nowIso,
    };

    if (status === 'sent') {
        updateData.sent_at = nowIso;
    } else if (status === 'retry') {
        const nextRetry = new Date(Date.now() + 5 * 60 * 1000).toISOString();
        updateData.next_retry_at = nextRetry;
        updateData.attempt_count = currentAttempt;
        if (existingData && typeof existingData === 'object') {
            updateData.data = {
                ...existingData,
                attempt_count: currentAttempt,
                next_retry_at: nextRetry,
                last_attempt_at: nowIso
            };
        }
    } else if (status === 'dead') {
        updateData.attempt_count = currentAttempt;
        if (existingData && typeof existingData === 'object') {
            updateData.data = {
                ...existingData,
                attempt_count: currentAttempt,
                is_dead: true,
                last_attempt_at: nowIso
            };
        }
    }

    try {
        await supabase.from('notifications').update(updateData).eq('id', id);
    } catch (uErr) {
        console.warn('[UPDATE STATUS WARN]', uErr);
    }
}

async function executeRetrySweep() {
    const nowIso = new Date().toISOString();
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();

    const { data: candidates, error: fetchErr } = await supabase
        .from('notifications')
        .select('*')
        .eq('status', 'retry')
        .or(`next_retry_at.lte.${nowIso},and(next_retry_at.is.null,created_at.lte.${fiveMinAgo})`)
        .limit(50);

    if (fetchErr) {
        console.error("[Push Retry Sweep] Query error:", fetchErr);
        return { success: false, error: fetchErr.message };
    }

    const list = candidates || [];
    if (list.length === 0) {
        return { success: true, processed: 0, message: "No retry candidates due" };
    }

    const accessToken = await getFcmAccessToken(FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY);
    let sentCount = 0;
    let deadCount = 0;
    let reRetryCount = 0;

    for (const notif of list) {
        try {
            // Atomic claim
            const { data: claimed } = await supabase
                .from('notifications')
                .update({ status: 'sending', last_attempt_at: nowIso })
                .eq('id', notif.id)
                .eq('status', 'retry')
                .select('id')
                .maybeSingle();

            if (!claimed) continue;

            const currentAttempt = Number(notif.attempt_count || notif.data?.attempt_count || 1);
            const nextAttempt = currentAttempt + 1;

            const { data: rawTokens } = await supabase
                .from('push_tokens')
                .select('token, device_type, last_updated_at')
                .eq('user_id', notif.user_id)
                .eq('is_active', true)
                .order('last_updated_at', { ascending: false });

            const tokens = (rawTokens || []) as PushTokenRecord[];
            if (tokens.length === 0) {
                await supabase.from('notifications').update({
                    status: 'failed',
                    error_message: 'No active push tokens found on retry'
                }).eq('id', notif.id);
                continue;
            }

            const deliveryTokens = selectDeliveryTokens(tokens);
            const uniqueTokensMap = new Map<string, PushTokenRecord>();
            deliveryTokens.forEach(t => uniqueTokensMap.set(t.token, t));
            const uniqueTokens = Array.from(uniqueTokensMap.values());

            const heroImage = notif.data?.hero_image;
            const results = await Promise.all(uniqueTokens.map(async (t) => {
                const message = buildFcmPayload(t.token, t.device_type, {
                    title: String(notif.title),
                    body: String(notif.body || ''),
                    data: typeof notif.data === 'object' ? notif.data : {},
                    heroImage: heroImage,
                    link: notif.data?.link,
                    eventType: notif.event_type,
                    relatedId: notif.related_id,
                });
                return await sendFcmMessageWithRetry(FIREBASE_PROJECT_ID, accessToken, message, 1);
            }));

            await pruneInvalidTokens(supabase, results);
            const success = results.some(r => r.status === 200);

            if (success) {
                await supabase.from('notifications').update({
                    status: 'sent',
                    sent_at: new Date().toISOString(),
                    attempt_count: nextAttempt
                }).eq('id', notif.id);
                sentCount++;
            } else {
                const resultSummary = JSON.stringify(results.map(r => ({
                    status: r.status,
                    err: r.resBody?.error?.message,
                    code: r.resBody?.error?.details?.[0]?.errorCode
                })));

                if (nextAttempt >= 3) {
                    await supabase.from('notifications').update({
                        status: 'dead',
                        attempt_count: nextAttempt,
                        error_message: `Max retries (3) exceeded: ${resultSummary}`
                    }).eq('id', notif.id);
                    deadCount++;
                } else {
                    const nextRetryAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
                    await supabase.from('notifications').update({
                        status: 'retry',
                        attempt_count: nextAttempt,
                        next_retry_at: nextRetryAt,
                        error_message: resultSummary
                    }).eq('id', notif.id);
                    reRetryCount++;
                }
            }
        } catch (e) {
            console.error(`[Push Retry Sweep] Item ${notif.id} error:`, e);
        }
    }

    return {
        success: true,
        totalProcessed: list.length,
        sentCount,
        deadCount,
        reRetryCount
    };
}
