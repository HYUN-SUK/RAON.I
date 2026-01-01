"use client";

import { createClient } from "@/lib/supabase-client";
import { useAuthModalStore } from "@/store/useAuthModalStore";
import { useRouter } from "next/navigation";

export function useRequireAuth() {
    const { open } = useAuthModalStore();
    const router = useRouter(); // Optional if we want to redirect directly, but we use modal now

    /**
     * Wraps an action with a login check.
     * @param action The callback to execute if logged in.
     * @param fallbackOptional Optional callback if not logged in (usually just opens modal).
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
