import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

export async function GET(request: NextRequest) {
    const requestUrl = new URL(request.url);
    const code = requestUrl.searchParams.get("code");
    const next = requestUrl.searchParams.get("next") ?? "/";

    if (code) {
        const supabase = await createClient();
        const { error } = await supabase.auth.exchangeCodeForSession(code);

        if (!error) {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                // Check if profile exists
                const { data: existingProfile } = await supabase
                    .from('profiles')
                    .select('id')
                    .eq('id', user.id)
                    .single();

                if (!existingProfile) {
                    // Check if profile is eligible for sign up (e.g. not withdrawn within 30 days)
                    const email = user.email || null;
                    
                    if (email) {
                        const { data: isEligible, error: checkError } = await supabase.rpc('check_signup_eligibility', { p_email: email });
                        if (!checkError && isEligible === false) {
                            // Sign out immediately and redirect to login page with error param
                            await supabase.auth.signOut();
                            const loginUrl = new URL("/login", request.url);
                            loginUrl.searchParams.set("error", "withdrawn");
                            return NextResponse.redirect(loginUrl);
                        }
                    }

                    // Create new profile
                    // Handle missing email gracefully (Kakao might not return it)
                    const nickname =
                        user.user_metadata.full_name ||
                        user.user_metadata.name ||
                        user.user_metadata.nickname ||
                        (email ? email.split('@')[0] : 'Camper');

                    const avatarUrl = user.user_metadata.avatar_url || user.user_metadata.picture;

                    // Insert with safe defaults
                    await supabase.from('profiles').insert({
                        id: user.id,
                        email: email,
                        nickname: nickname,
                        avatar_url: avatarUrl,
                        role: 'user',
                        created_at: new Date().toISOString(),
                    });
                }
            }
        }
    }

    // URL to redirect to after sign in process completes
    return NextResponse.redirect(new URL(next, request.url));
}
