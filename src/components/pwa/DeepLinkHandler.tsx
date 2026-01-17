'use client';

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";

export default function DeepLinkHandler() {
    const router = useRouter();
    const searchParams = useSearchParams();

    useEffect(() => {
        const redirectUrl = searchParams.get('push_redirect');
        if (redirectUrl) {
            router.replace(redirectUrl);
        }
    }, [searchParams, router]);

    return null;
}
