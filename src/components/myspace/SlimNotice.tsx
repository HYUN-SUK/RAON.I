"use client";

import { useEffect, useState } from "react";
import { Megaphone } from "lucide-react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-client";

interface Notice {
    id: string;
    title: string;
}

export default function SlimNotice() {
    const router = useRouter();
    const [notice, setNotice] = useState<Notice | null>(null);

    useEffect(() => {
        fetchLatestNotice();
    }, []);

    const fetchLatestNotice = async () => {
        const supabase = createClient();
        const { data } = await supabase
            .from('posts')
            .select('id, title, meta_data')
            .eq('type', 'NOTICE')
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

        // status가 OPEN인 공지만 표시 (CLOSED이면 숨김)
        if (data) {
            const metaData = data.meta_data as Record<string, unknown> | null;
            const status = metaData?.status || 'OPEN';
            if (status !== 'CLOSED') {
                setNotice(data);
            }
        }
    };

    // 공지가 없으면 숨김
    if (!notice) return null;

    return (
        <div className="px-6 pb-4">
            <div
                onClick={() => router.push('/community?tab=NOTICE')}
                className="glass-panel flex items-center gap-3 px-5 py-3 rounded-2xl cursor-pointer hover:bg-white/90 active:scale-95 transition-all duration-200"
            >
                <div className="p-1.5 bg-brand-1/10 rounded-full">
                    <Megaphone size={14} className="text-brand-1" fill="currentColor" />
                </div>
                <span className="text-xs font-medium text-text-1 truncate tracking-tight">
                    <span className="font-bold text-brand-1 mr-1">공지</span>
                    {notice.title}
                </span>
            </div>
        </div>
    );
}
