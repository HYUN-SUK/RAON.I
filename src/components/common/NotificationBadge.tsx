'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Bell } from 'lucide-react';
import { createClient } from '@/lib/supabase-client';

interface NotificationBadgeProps {
    className?: string;
    variant?: 'floating' | 'inline' | 'hero';
}

export default function NotificationBadge({ className = '', variant = 'inline' }: NotificationBadgeProps) {
    const router = useRouter();
    const [latestNotification, setLatestNotification] = useState<{ title: string; created_at: string } | null>(null);

    useEffect(() => {
        const fetchLatest = async () => {
            const supabase = createClient();
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) return;

            const { data, error } = await supabase
                .from('notifications')
                .select('title, created_at')
                .eq('user_id', session.user.id)
                .order('created_at', { ascending: false })
                .limit(1)
                .single();

            if (data && !error) {
                setLatestNotification(data);
            }
        };

        fetchLatest();

        // Optional: Realtime subscription could be added here
    }, []);

    if (!latestNotification) return null;

    const handleClick = () => {
        router.push('/notifications');
    };

    if (variant === 'hero') {
        return (
            <button
                onClick={handleClick}
                className={`absolute top-4 right-4 flex items-center gap-2 bg-white/20 backdrop-blur-md border border-white/30 rounded-full px-3 py-1.5 shadow-lg active:scale-95 transition-transform z-30 ${className}`}
            >
                <div className="relative">
                    <Bell className="w-4 h-4 text-white" />
                    <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                </div>
                <span className="text-xs text-white font-medium truncate max-w-[120px]">
                    {latestNotification.title}
                </span>
                <span className="text-[10px] text-white/70">확인하기</span>
            </button>
        );
    }

    // Default / Inline (for MySpace)
    return (
        <button
            onClick={handleClick}
            className={`flex items-center gap-2 w-full mx-auto max-w-sm bg-stone-100 dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 rounded-lg p-3 my-2 shadow-sm hover:bg-stone-200 dark:hover:bg-zinc-700 transition-colors ${className}`}
        >
            <div className="bg-white dark:bg-black p-1.5 rounded-full border border-stone-200 dark:border-zinc-700 relative">
                <Bell className="w-4 h-4 text-[#C3A675]" />
                <span className="absolute top-0 right-0 w-2 h-2 bg-red-500 rounded-full animate-bounce" />
            </div>
            <div className="text-left flex-1 min-w-0">
                <p className="text-xs text-stone-500 dark:text-stone-400 font-bold mb-0.5">알림 내역 확인</p>
                <p className="text-sm text-stone-800 dark:text-stone-200 truncate font-medium">
                    {latestNotification.title}
                </p>
            </div>
            <span className="text-xs text-stone-400 whitespace-nowrap px-2 py-1 bg-white dark:bg-black rounded border border-stone-200 dark:border-zinc-700">
                이동
            </span>
        </button>
    );
}
