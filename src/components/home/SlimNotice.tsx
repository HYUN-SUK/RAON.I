'use client';

import { useEffect, useState, memo } from 'react';
import { Volume2 } from 'lucide-react';
import { useRouter } from "next/navigation";
import { createClient } from '@/lib/supabase-client';

interface Notice {
    id: string;
    title: string;
}

interface SlimNoticeProps {
    variant?: 'hero' | 'bottom' | 'home';
}

const SlimNotice = memo(function SlimNotice({ variant = 'bottom' }: SlimNoticeProps) {
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

    if (variant === 'home') {
        return (
            <div
                onClick={() => router.push('/community?tab=NOTICE')}
                className="flex-1 min-w-0 flex items-center gap-2 px-3 py-2 bg-stone-100/90 hover:bg-stone-200/80 dark:bg-zinc-850 dark:hover:bg-zinc-800 border border-stone-200/80 dark:border-zinc-700/80 rounded-2xl text-stone-700 dark:text-stone-300 cursor-pointer active:scale-[0.99] transition-all shadow-2xs"
            >
                <div className="w-5 h-5 rounded-lg bg-[#388E5A]/15 dark:bg-emerald-950/40 flex items-center justify-center shrink-0">
                    <Volume2 className="w-3.5 h-3.5 text-[#388E5A] dark:text-[#388E5A]" />
                </div>
                <span className="truncate font-bold text-stone-800 dark:text-stone-200 flex-1 text-xs">{notice.title}</span>
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-stone-400 shrink-0"><path d="m9 18 6-6-6-6" /></svg>
            </div>
        );
    }

    if (variant === 'hero') {
        return (
            <div
                onClick={() => router.push('/community?tab=NOTICE')}
                className="flex-1 min-w-0 max-w-[170px] flex items-center gap-1.5 px-2.5 py-1.5 bg-black/20 hover:bg-black/35 backdrop-blur-sm rounded-xl text-white cursor-pointer active:scale-95 transition-all text-[10px]"
            >
                <Volume2 className="w-3.5 h-3.5 text-[#C3A675] shrink-0" />
                <span className="truncate font-semibold flex-1 max-w-[100px] xs:max-w-[115px]">{notice.title}</span>
                <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="opacity-75 flex-shrink-0"><path d="m9 18 6-6-6-6" /></svg>
            </div>
        );
    }

    return (
        <div
            onClick={() => router.push('/community?tab=NOTICE')}
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
});

export default SlimNotice;


