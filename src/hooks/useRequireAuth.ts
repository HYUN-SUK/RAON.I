"use client";

import { createClient } from "@/lib/supabase-client";
import { useAuthModalStore } from "@/store/useAuthModalStore";

export function useRequireAuth() {
    const { open } = useAuthModalStore();

    /**
     * Wraps an action with a login check.
     */
    const withAuth = async (action: () => void | Promise<void>) => {
        const supabase = createClient();
        const { data: { session } } = await supabase.auth.getSession();

        if (session) {
            await action();
        } else {
            open(); // Trigger the global login dialog
        }
    };

    return { withAuth };
}
