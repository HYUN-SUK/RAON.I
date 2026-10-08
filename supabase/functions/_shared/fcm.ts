/**
 * RAON.I Shared FCM Module (v2.0 - SSOT)
 * 
 * - FCM HTTP v1 API OAuth2 JWT Token Management (50m in-memory cache)
 * - Samsung Browser duplicate push suppression (Filter out web tokens if native app token exists)
 * - Standard Native Foreground/Background Heads-up Banner Payload
 * - Safe Token Cleanup (Deletes ONLY on 404 / UNREGISTERED, never on 400)
 */

import * as jose from "https://deno.land/x/jose@v4.14.4/index.ts";

export interface PushTokenRecord {
    token: string;
    device_type?: string;
    last_updated_at?: string;
}

export interface FcmPayloadOptions {
    title: string;
    body: string;
    data?: Record<string, string>;
    heroImage?: string;
    link?: string;
    eventType?: string;
    relatedId?: string;
}

// In-memory token cache to avoid redundant Google OAuth round-trips
let cachedAccessToken: string | null = null;
let tokenExpiresAt = 0;

/**
 * 1. Get or Refresh Google OAuth2 Access Token for FCM HTTP v1
 */
export async function getFcmAccessToken(
    clientEmail: string,
    privateKeyRaw: string
): Promise<string> {
    const now = Date.now();
    if (cachedAccessToken && now < tokenExpiresAt - 300000) { // 5-minute safety margin
        return cachedAccessToken;
    }

    if (!clientEmail || !privateKeyRaw) {
        throw new Error("Missing Firebase Client Email or Private Key");
    }

    const privateKey = privateKeyRaw.replace(/\\n/g, '\n');

    try {
        const jwt = await new jose.SignJWT({
            iss: clientEmail,
            scope: "https://www.googleapis.com/auth/firebase.messaging",
            aud: "https://oauth2.googleapis.com/token",
        })
            .setProtectedHeader({ alg: "RS256" })
            .setIssuedAt()
            .setExpirationTime("1h")
            .sign(await jose.importPKCS8(privateKey, "RS256"));

        const response = await fetch("https://oauth2.googleapis.com/token", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
                grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
                assertion: jwt,
            }),
        });

        const data = await response.json();
        if (!data.access_token) {
            throw new Error(`FCM Token Error: ${JSON.stringify(data)}`);
        }

        cachedAccessToken = data.access_token;
        tokenExpiresAt = now + (data.expires_in ? data.expires_in * 1000 : 3600000);
        return cachedAccessToken;
    } catch (err) {
        console.error("[FCM AUTH] Failed to retrieve access token:", err);
        throw err;
    }
}

/**
 * 2. Device Filtering SSOT:
 * If user has at least one active native app token (android/ios),
 * suppress ALL legacy web tokens so Samsung Browser / Chrome WebPush won't fire duplicates.
 */
export function selectDeliveryTokens(tokens: PushTokenRecord[]): PushTokenRecord[] {
    if (!tokens || tokens.length === 0) return [];

    const hasAppToken = tokens.some(t => t.device_type === 'android' || t.device_type === 'ios');

    if (hasAppToken) {
        const appTokens = tokens.filter(t => t.device_type === 'android' || t.device_type === 'ios');
        console.log(`[FCM Filter] Native App user detected. Delivered to ${appTokens.length} app token(s) and suppressed ${tokens.length - appTokens.length} legacy web token(s).`);
        return appTokens;
    }

    // Pure web users (PC / Mobile web without app installed)
    console.log(`[FCM Filter] Pure web user. Delivering to ${tokens.length} web token(s).`);
    return tokens;
}

/**
 * 3. Build Standard FCM v1 Payload
 * Guarantees Heads-up Rich Banner + Vibration + Sound in both foreground & background
 */
export function buildFcmPayload(
    token: string,
    deviceType: string | undefined,
    options: FcmPayloadOptions
): any {
    const heroImage = options.heroImage;
    const linkPath = options.link || "/notifications";
    const fullLink = linkPath.startsWith('http') ? linkPath : `https://raon-i.co.kr${linkPath.startsWith('/') ? linkPath : `/${linkPath}`}`;

    // Flatten all data attributes into string key-values (FCM v1 requirement)
    const stringData: Record<string, string> = {
        title: String(options.title),
        body: String(options.body),
        link: linkPath,
        full_link: fullLink,
        event_type: String(options.eventType || 'default'),
        related_id: String(options.relatedId || 'general'),
    };
    if (heroImage) {
        stringData.hero_image = heroImage;
    }

    if (options.data && typeof options.data === 'object') {
        Object.entries(options.data).forEach(([k, v]) => {
            stringData[k] = String(v ?? '');
        });
    }

    const isWeb = deviceType === 'web';

    const rootNotification: any = {
        title: String(options.title),
        body: String(options.body),
    };
    if (heroImage) {
        rootNotification.image = heroImage;
    }

    const androidNotification: any = {
        channel_id: "raon_notifications",
        sound: "default",
        icon: "ic_launcher",
        color: "#22C55E",
        default_vibrate_timings: true,
        notification_priority: "PRIORITY_MAX", // Force high-importance popup banner
        visibility: "PUBLIC",                 // Visible on secure lockscreens
    };
    if (heroImage) {
        androidNotification.image = heroImage;
    }

    const payload: any = {
        message: {
            token: token,
            // Root notification: Critical for Capacitor foreground banner + background system tray
            notification: rootNotification,
            data: stringData,
            android: {
                priority: "high", // Immediate Doze Mode exit & heads-up banner
                notification: androidNotification
            }
        }
    };

    // If target is a web token, attach webpush headers
    if (isWeb) {
        payload.message.webpush = {
            headers: {
                Urgency: "high",
                TTL: "86400"
            },
            notification: {
                title: String(options.title),
                body: String(options.body),
                icon: "https://raon-i.co.kr/icons/icon-192.png",
                badge: "https://raon-i.co.kr/badge.png",
                ...(heroImage ? { image: heroImage } : {}),
                vibrate: [300, 150, 300],
            },
            fcm_options: {
                link: fullLink
            }
        };
    }

    return payload;
}

/**
 * 4. Send Message via FCM HTTP v1 API
 */
export async function sendFcmMessage(
    projectId: string,
    accessToken: string,
    payload: any
): Promise<{ status: number; resBody: any }> {
    try {
        const res = await fetch(
            `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`,
            {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${accessToken}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(payload),
            }
        );

        const resBody = await res.json();
        return { status: res.status, resBody };
    } catch (err: any) {
        console.error("[FCM SEND] Network exception:", err);
        return { status: 500, resBody: { error: err.message } };
    }
}

/**
 * 5. Safe Invalid Token Pruning
 * CRITICAL: Deletes ONLY on 404 (UNREGISTERED / NOT_FOUND).
 * NEVER deletes on 400 (which may be caused by payload validation or temporary issues).
 */
export async function pruneInvalidTokens(
    supabase: any,
    results: Array<{ token: string; status: number; resBody: any }>
): Promise<number> {
    const invalidTokens = results
        .filter(r => {
            const errCode = r.resBody?.error?.details?.[0]?.errorCode;
            const status = r.resBody?.error?.status;
            // Strict 404 check: Only delete if Google explicitly confirms token is dead
            return (
                r.status === 404 ||
                status === 'UNREGISTERED' ||
                status === 'NOT_FOUND' ||
                errCode === 'UNREGISTERED'
            );
        })
        .map(r => r.token);

    if (invalidTokens.length > 0) {
        console.log(`[FCM CLEANUP] Safely pruning ${invalidTokens.length} confirmed unregistered token(s)...`);
        await supabase.from('push_tokens').delete().in('token', invalidTokens);
    }

    return invalidTokens.length;
}
