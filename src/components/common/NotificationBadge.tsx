'use client';

import React, { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Bell } from 'lucide-react';
import { createClient } from '@/lib/supabase-client';

interface NotificationBadgeProps {
    className?: string;
    variant?: 'floating' | 'inline' | 'hero';
}

export default function NotificationBadge({ className = '', variant = 'inline' }: NotificationBadgeProps) {
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
                const stored = sessionStorage.getItem('last_read_notifications_at');
                setLastReadAt(stored);
            }

            let query = supabase
                .from('notifications')
                .select('title, created_at, is_read')
                .eq('user_id', session.user.id);

            // Apply filter BEFORE order/limit
            if (variant === 'hero') {
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

    if (!latestNotification || (variant === 'hero' && isLocallyRead)) return null;

    const handleClick = () => {
        router.push('/notifications');
    };

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
            className={`flex items-center gap-2 w-full mx-auto max-w-sm bg-stone-100 dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 rounded-lg p-3 my-2 shadow-sm hover:bg-stone-200 dark:hover:bg-zinc-700 transition-colors ${className}`}
        >
            <div className="bg-white dark:bg-black p-1.5 rounded-full border border-stone-200 dark:border-zinc-700 relative">
                <Bell className="w-4 h-4 text-[#C3A675]" />
                {(!latestNotification.is_read && !isLocallyRead) && (
                    <span className="absolute top-0 right-0 w-2 h-2 bg-red-500 rounded-full animate-bounce" />
                )}
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
