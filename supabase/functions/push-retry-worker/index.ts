import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import {
    getFcmAccessToken,
    selectDeliveryTokens,
    buildFcmPayload,
    sendFcmMessageWithRetry,
    classifyFcmResult,
    pruneInvalidTokens,
    PushTokenRecord
} from "../_shared/fcm.ts";

/**
 * Supabase Edge Function: push-retry-worker (v1.0)
 * 
 * Purpose:
 * Periodically polls and recovers temporary notification failures.
 * - Atomically claims rows (status = 'retry' -> 'sending') to prevent race conditions.
 * - Prunes dead tokens (404 / UNREGISTERED).
 * - Retries up to 3 times before isolating into 'dead' state.
 */

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const FIREBASE_PROJECT_ID = Deno.env.get('FIREBASE_PROJECT_ID') || '';
const FIREBASE_CLIENT_EMAIL = Deno.env.get('FIREBASE_CLIENT_EMAIL') || '';
const FIREBASE_PRIVATE_KEY = Deno.env.get('FIREBASE_PRIVATE_KEY') || '';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('RAON_SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        console.log("[Push Retry Worker] Starting sweep cycle...");
        const nowIso = new Date().toISOString();

        // 1. Fetch eligible retry notifications (batch of 50)
        // Checks status='retry' and due next_retry_at (or fallback created_at > 5 min ago)
        const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
        const { data: candidates, error: fetchErr } = await supabase
            .from('notifications')
            .select('*')
            .eq('status', 'retry')
            .or(`next_retry_at.lte.${nowIso},and(next_retry_at.is.null,created_at.lte.${fiveMinAgo})`)
            .limit(50);

        if (fetchErr) {
            console.error("[Push Retry Worker] Query error:", fetchErr);
            throw fetchErr;
        }

        const list = candidates || [];
        if (list.length === 0) {
            console.log("[Push Retry Worker] No retry candidates found. Cycle complete.");
            return new Response(JSON.stringify({ success: true, processed: 0 }), {
                headers: { ...corsHeaders, "Content-Type": "application/json" }
            });
        }

        console.log(`[Push Retry Worker] Found ${list.length} candidate(s) for retry.`);
        const accessToken = await getFcmAccessToken(FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY);

        let sentCount = 0;
        let deadCount = 0;
        let reRetryCount = 0;

        for (const notif of list) {
            try {
                // 2. Atomic Claim Guard (Race-condition protection)
                const { data: claimed, error: claimErr } = await supabase
                    .from('notifications')
                    .update({ status: 'sending', last_attempt_at: nowIso })
                    .eq('id', notif.id)
                    .eq('status', 'retry')
                    .select('id')
                    .maybeSingle();

                if (claimErr || !claimed) {
                    console.log(`[Push Retry Worker] Notification ${notif.id} already claimed or processed. Skipping.`);
                    continue;
                }

                // Current attempt count tracking
                const currentAttempt = Number(notif.attempt_count || notif.data?.attempt_count || 1);
                const nextAttempt = currentAttempt + 1;

                // 3. Fetch User's Active Tokens
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

                // 4. Dispatch FCM with In-memory Backoff
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

                // 5. Clean up dead tokens (404)
                await pruneInvalidTokens(supabase, results);

                // 6. Outcome evaluation
                const success = results.some(r => r.status === 200);
                if (success) {
                    await supabase.from('notifications').update({
                        status: 'sent',
                        sent_at: new Date().toISOString(),
                        attempt_count: nextAttempt,
                        data: {
                            ...(typeof notif.data === 'object' ? notif.data : {}),
                            attempt_count: nextAttempt,
                            recovered_by_worker: true
                        }
                    }).eq('id', notif.id);
                    sentCount++;
                    console.log(`[Push Retry Worker] Successfully recovered notification ${notif.id} on attempt ${nextAttempt}!`);
                } else {
                    const resultSummary = JSON.stringify(results.map(r => ({
                        status: r.status,
                        err: r.resBody?.error?.message,
                        code: r.resBody?.error?.details?.[0]?.errorCode
                    })));

                    if (nextAttempt >= 3) {
                        // Max retries exceeded -> isolate to 'dead'
                        await supabase.from('notifications').update({
                            status: 'dead',
                            attempt_count: nextAttempt,
                            error_message: `Max retries (3) exceeded: ${resultSummary}`,
                            data: {
                                ...(typeof notif.data === 'object' ? notif.data : {}),
                                attempt_count: nextAttempt,
                                is_dead: true
                            }
                        }).eq('id', notif.id);
                        deadCount++;
                        console.warn(`[Push Retry Worker] Notification ${notif.id} marked as DEAD after ${nextAttempt} attempts.`);
                    } else {
                        // Re-queue with 10-minute backoff
                        const nextRetryAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
                        await supabase.from('notifications').update({
                            status: 'retry',
                            attempt_count: nextAttempt,
                            next_retry_at: nextRetryAt,
                            error_message: resultSummary,
                            data: {
                                ...(typeof notif.data === 'object' ? notif.data : {}),
                                attempt_count: nextAttempt,
                                next_retry_at: nextRetryAt
                            }
                        }).eq('id', notif.id);
                        reRetryCount++;
                        console.log(`[Push Retry Worker] Notification ${notif.id} scheduled for attempt ${nextAttempt + 1} at ${nextRetryAt}.`);
                    }
                }
            } catch (singleErr) {
                console.error(`[Push Retry Worker] Error processing notif ${notif.id}:`, singleErr);
            }
        }

        return new Response(JSON.stringify({
            success: true,
            totalProcessed: list.length,
            sentCount,
            deadCount,
            reRetryCount
        }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" }
        });

    } catch (err: any) {
        console.error("[Push Retry Worker] Fatal cycle error:", err);
        return new Response(JSON.stringify({ error: err.message }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
    }
});
