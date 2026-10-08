import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import {
    getFcmAccessToken,
    selectDeliveryTokens,
    buildFcmPayload,
    sendFcmMessage,
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

                const res = await sendFcmMessage(FIREBASE_PROJECT_ID, accessToken, message);
                console.log(`[FCM SEND] Token: ${t.token.slice(0, 15)}... | Device: ${t.device_type || 'web'} | Status: ${res.status}`);
                return { token: t.token, status: res.status, resBody: res.resBody };
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

        // 8. Update Notification Record Status
        const finalStatus = successCount > 0 ? 'sent' : 'failed';
        const resultSummary = JSON.stringify(results.map(r => ({
            status: r.status,
            err: r.resBody?.error?.message,
            code: r.resBody?.error?.details?.[0]?.errorCode
        })));

        if (id) {
            await updateNotificationStatus(id, finalStatus, resultSummary);
        }

        return new Response(JSON.stringify({
            success: successCount > 0,
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

async function updateNotificationStatus(id: string, status: string, resultSummary: string) {
    const updateData: any = {
        status,
        error_message: resultSummary,
    };
    if (status === 'sent') {
        updateData.sent_at = new Date().toISOString();
    }
    await supabase.from('notifications').update(updateData).eq('id', id);
}
