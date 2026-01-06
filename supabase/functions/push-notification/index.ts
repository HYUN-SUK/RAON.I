import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
import * as jose from "https://deno.land/x/jose@v4.14.4/index.ts";

/**
 * Supabase Edge Function: push-notification
 * Triggered by Database Webhook (INSERT on public.notifications)
 */

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Firebase Settings (Set these in Supabase Dashboard Secrets)
const FIREBASE_PROJECT_ID = Deno.env.get('FIREBASE_PROJECT_ID');
const FIREBASE_CLIENT_EMAIL = Deno.env.get('FIREBASE_CLIENT_EMAIL');
const FIREBASE_PRIVATE_KEY = Deno.env.get('FIREBASE_PRIVATE_KEY')?.replace(/\\n/g, '\n');

// Supabase Settings
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

/**
 * Get Google Access Token for FCM HTTP v1 API
 */
async function getAccessToken() {
    if (!FIREBASE_CLIENT_EMAIL || !FIREBASE_PRIVATE_KEY) {
        throw new Error("Missing Firebase Credentials");
    }

    const jwt = await new jose.SignJWT({
        iss: FIREBASE_CLIENT_EMAIL,
        scope: "https://www.googleapis.com/auth/firebase.messaging",
        aud: "https://oauth2.googleapis.com/token",
    })
        .setProtectedHeader({ alg: "RS256" })
        .setExpirationTime("1h")
        .sign(await jose.importPKCS8(FIREBASE_PRIVATE_KEY, "RS256"));

    const response = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
            grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
            assertion: jwt,
        }),
    });

    const data = await response.json();
    return data.access_token;
}

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const payload = await req.json();
        console.log("Received payload:", JSON.stringify(payload));

        // 1. Validate Payload (Supabase Database Webhook format)
        const record = payload.record;
        if (!record || !record.user_id || !record.title) {
            // Manual invocation support (for testing)
            if (payload.user_id) return handleManualSend(payload);
            throw new Error("Invalid payload format. Expected 'record' from DB Webhook.");
        }

        const { id, user_id, title, body, data } = record;

        console.log(`Processing notification ${id} for user ${user_id}`);

        // 2. Fetch User's Push Tokens
        const { data: tokens, error: tokenError } = await supabase
            .from('push_tokens')
            .select('token')
            .eq('user_id', user_id);

        if (tokenError) throw tokenError;
        if (!tokens || tokens.length === 0) {
            console.log(`No tokens found for user ${user_id}`);
            await updateNotificationStatus(id, 'failed', 'No tokens found');
            return new Response(JSON.stringify({ message: "No tokens found" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }

        // 3. Get FCM Access Token
        const accessToken = await getAccessToken();

        // 4. Send to All Tokens
        const results = await Promise.all(tokens.map(async (t) => {
            const message = {
                message: {
                    token: t.token,
                    notification: {
                        title: title,
                        body: body,
                    },
                    data: data || {}, // Custom data
                    webpush: {
                        fcm_options: {
                            link: "https://raon-i.vercel.app/myspace" // TODO: config
                        }
                    }
                }
            };

            const res = await fetch(
                `https://fcm.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/messages:send`,
                {
                    method: "POST",
                    headers: {
                        "Authorization": `Bearer ${accessToken}`,
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify(message),
                }
            );

            return { token: t.token, status: res.status, body: await res.json() };
        }));

        // 5. Cleanup Invalid Tokens & Update Status
        const successCount = results.filter(r => r.status === 200).length;
        const failureCount = results.length - successCount;

        // Determine final status
        const finalStatus = successCount > 0 ? 'sent' : 'failed';
        const resultSummary = JSON.stringify(results.map(r => ({ status: r.status, err: r.body.error?.message })));

        await updateNotificationStatus(id, finalStatus, resultSummary); // Update sent_at if success

        return new Response(JSON.stringify({ success: true, results }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });

    } catch (error) {
        console.error("Error processing request:", error);
        return new Response(JSON.stringify({ error: error.message }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
});

async function updateNotificationStatus(id: string, status: string, result: string) {
    const updateData: any = { status, result };
    if (status === 'sent') {
        updateData.sent_at = new Date().toISOString();
    }
    await supabase.from('notifications').update(updateData).eq('id', id);
}

// Helper for manual testing via direct RPC/Invoke
async function handleManualSend(payload: any) {
    const { user_id, title, body, data } = payload;
    // ... Simplified logic reuse or similar ...
    return new Response(JSON.stringify({ message: "Manual send not fully implemented yet in this snippet" }), { headers: corsHeaders });
}
