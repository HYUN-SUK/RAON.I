'use client';

import { useEffect, useState } from 'react';
import { Volume2 } from 'lucide-react';
import { useRouter } from "next/navigation";
import { createClient } from '@/lib/supabase-client';

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
        <div
            onClick={() => router.push('/community?tab=notice')}
            className="w-full bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md border-t border-stone-100 dark:border-zinc-800 py-3 px-4 flex items-center gap-3 cursor-pointer active:bg-stone-50 dark:active:bg-zinc-800 transition-colors"
        >
            <Volume2 className="w-4 h-4 text-[#C3A675] shrink-0" />
            <div className="flex-1 overflow-hidden h-5 relative">
                <p className="text-xs text-stone-600 dark:text-stone-400 truncate">
                    {notice.title}
                </p>
            </div>
            <div className="text-stone-400">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6" /></svg>
            </div>
        </div>
    );
}
