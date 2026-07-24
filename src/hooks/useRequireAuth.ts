"use client";

import { createClient } from "@/lib/supabase-client";
import { useAuthModalStore } from "@/store/useAuthModalStore";

export function useRequireAuth() {
    const { open } = useAuthModalStore();

    /**
     * Wraps an action with a login check.
     * [v11.9.125] 세션 조회가 600ms 이상 지연될 경우 묵은 이벤트로 판단하여 뒤늦은 라우팅 발화를 자동 무효화함.
     */
    const withAuth = async (action: () => void | Promise<void>) => {
        const startTime = Date.now();
        const supabase = createClient();
        const { data: { session } } = await supabase.auth.getSession();

        // 600ms 이상 지연 획득된 경우 묵은 라우팅 발화 방지를 위해 스킵
        if (Date.now() - startTime > 600) {
            console.warn('[useRequireAuth] Auth session fetch took longer than 600ms. Skipping late action trigger.');
            return;
        }

        if (session) {
            await action();
        } else {
            open(); // Trigger the global login dialog
        }
    };

    return { withAuth };
}
