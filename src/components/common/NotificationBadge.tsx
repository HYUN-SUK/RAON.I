'use client';

import React, { useEffect, useState, memo } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Bell } from 'lucide-react';
import { createClient } from '@/lib/supabase-client';

interface NotificationBadgeProps {
    className?: string;
    variant?: 'floating' | 'inline' | 'hero' | 'home';
}

const NotificationBadge = memo(function NotificationBadge({ className = '', variant = 'inline' }: NotificationBadgeProps) {
    const router = useRouter();
    const [latestNotification, setLatestNotification] = useState<{ title: string; created_at: string; is_read: boolean } | null>(null);
    const [lastReadAt, setLastReadAt] = useState<string | null>(null);

    const pathname = usePathname();

    useEffect(() => {
        const supabase = createClient();
        let channel: any = null;

        const fetchLatest = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) return;

            if (typeof window !== 'undefined') {
                let stored: string | null = null;
                try {
                    const sessionStored = window.sessionStorage?.getItem('last_read_notifications_at');
                    const localStored = window.localStorage?.getItem(`raon_last_read_notifications_${session.user.id}`);
                    stored = sessionStored || localStored || null;
                } catch {}
                setLastReadAt(stored);
            }

            let query = supabase
                .from('notifications')
                .select('title, created_at, is_read')
                .eq('user_id', session.user.id);

            // Apply filter BEFORE order/limit
            if (variant === 'hero' || variant === 'home') {
                query = query.eq('is_read', false);
            }

            const { data, error } = await query
                .order('created_at', { ascending: false })
                .limit(1)
                .single();

            if (data && !error) {
                setLatestNotification(data);
            } else {
                setLatestNotification(null); // Clear if no data
            }

            // [REALTIME SYNC] Listen to Postgres changes for user notifications (is_read update, etc.)
            if (!channel) {
                channel = supabase
                    .channel(`public:notifications:user:${session.user.id}`)
                    .on(
                        'postgres_changes',
                        {
                            event: '*',
                            schema: 'public',
                            table: 'notifications',
                            filter: `user_id=eq.${session.user.id}`
                        },
                        (payload) => {
                            console.log('[Realtime Badge] Changes detected:', payload);
                            fetchLatest();
                        }
                    )
                    .subscribe();
            }
        };

        fetchLatest();

        return () => {
            if (channel) {
                supabase.removeChannel(channel);
            }
        };
    }, [pathname]); // Refresh on navigation / Realtime ensures immediate UI cleanup

    const isLocallyRead = latestNotification && lastReadAt && new Date(latestNotification.created_at) <= new Date(lastReadAt);

    if (!latestNotification || ((variant === 'hero' || variant === 'home') && isLocallyRead)) return null;

    const handleClick = () => {
        router.push('/notifications');
    };

    if (variant === 'home') {
        return (
            <button
                onClick={handleClick}
                className={`flex items-center gap-1.5 px-3 py-2 bg-stone-100/90 hover:bg-stone-200/80 dark:bg-zinc-850 dark:hover:bg-zinc-800 border border-stone-200/80 dark:border-zinc-700/80 rounded-2xl text-stone-700 dark:text-stone-300 shadow-2xs active:scale-95 transition-all shrink-0 cursor-pointer ${className}`}
            >
                <div className="relative flex-shrink-0">
                    <Bell className="w-3.5 h-3.5 text-[#388E5A] dark:text-[#388E5A]" />
                    <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
                </div>
                <span className="text-xs font-bold text-stone-800 dark:text-stone-200 truncate max-w-[80px]">
                    {latestNotification.title}
                </span>
                <span className="text-[9px] bg-red-500 text-white font-extrabold px-1.5 py-0.2 rounded-full shrink-0">
                    N
                </span>
            </button>
        );
    }

    if (variant === 'hero') {
        return (
            <button
                onClick={handleClick}
                className={`flex-1 min-w-0 max-w-[130px] flex items-center justify-between gap-1.5 bg-white/20 backdrop-blur-md border border-white/30 rounded-xl px-2.5 py-1.5 shadow-lg active:scale-95 transition-all z-30 ${className}`}
            >
                <div className="relative flex-shrink-0">
                    <Bell className="w-3.5 h-3.5 text-white" />
                    <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
                </div>
                <span className="text-[10px] text-white font-semibold truncate flex-1 text-left max-w-[50px] xs:max-w-[70px]">
                    {latestNotification.title}
                </span>
                <span className="text-[9px] text-white/70 font-bold flex-shrink-0">확인</span>
            </button>
        );
    }

    // Default / Inline (for MySpace)
    return (
        <button
            onClick={handleClick}
            className={`flex items-center gap-3 w-full mx-auto max-w-sm bg-white border border-[#EAEFEA] rounded-2xl p-3.5 my-2 shadow-xs hover:border-[#68A678] hover:bg-[#F4F8F5]/60 transition-all ${className}`}
        >
            <div className="bg-[#E1EFE4] p-2 rounded-xl relative flex-shrink-0">
                <Bell className="w-4 h-4 text-[#2E7D47]" />
                {(!latestNotification.is_read && !isLocallyRead) && (
                    <span className="absolute top-0 right-0 w-2 h-2 bg-[#E06B62] rounded-full animate-bounce" />
                )}
            </div>
            <div className="text-left flex-1 min-w-0">
                <p className="text-xs text-[#7A8B7E] font-bold mb-0.5">알림 내역 확인</p>
                <p className="text-sm text-[#1E4D2B] truncate font-black">
                    {latestNotification.title}
                </p>
            </div>
            <span className="text-xs text-[#2E7D47] font-bold whitespace-nowrap px-2.5 py-1 bg-[#F4F8F5] rounded-lg border border-[#B3C9B8]">
                이동
            </span>
        </button>
    );
});

export default NotificationBadge;
