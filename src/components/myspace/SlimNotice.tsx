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
                className="bg-[#E2EFE5] border border-[#B3C9B8] flex items-center gap-3 px-5 py-3 rounded-2xl cursor-pointer hover:bg-[#D8ECDD] active:scale-95 transition-all duration-200 shadow-xs"
            >
                <div className="p-1.5 bg-white rounded-full flex items-center justify-center shadow-2xs">
                    <Megaphone size={14} className="text-[#2E7D47]" fill="currentColor" />
                </div>
                <span className="text-xs font-semibold text-[#1E4D2B] truncate tracking-tight">
                    <span className="font-black text-[#2E7D47] mr-1.5">공지</span>
                    {notice.title}
                </span>
            </div>
        </div>
    );
}
