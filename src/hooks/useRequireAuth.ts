"use client";

import { createClient } from "@/lib/supabase-client";
import { useAuthModalStore } from "@/store/useAuthModalStore";

export function useRequireAuth() {
    const { open } = useAuthModalStore();

    /**
     * Wraps an action with a login check.
     */
    const withAuth = async (action: () => void | Promise<void>) => {
        const startTime = Date.now();
        const supabase = createClient();
        const { data: { session } } = await supabase.auth.getSession();

        // [v11.9.145] 세션 조회가 500ms 이상 지연된 경우 묵은 라우팅 실행 방지를 위해 무효화 스킵
        if (Date.now() - startTime > 500) {
            console.warn('[useRequireAuth] Auth session fetch took longer than 500ms. Skipping late action trigger.');
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
