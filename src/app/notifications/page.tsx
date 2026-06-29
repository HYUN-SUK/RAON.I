'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase-client';
import TopBar from '@/components/TopBar';
import { ChevronLeft, Bell, Clock, Calendar, MessageSquare, Info } from 'lucide-react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { Skeleton } from '@/components/ui/skeleton';

interface Notification {
    id: string;
    title: string;
    body: string;
    created_at: string;
    event_type: string;
    is_read: boolean;
    data: any;
}

export default function NotificationsPage() {
    const router = useRouter();
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchNotifications = async () => {
            const supabase = createClient();
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
                router.replace('/login');
                return;
            }

            const { data, error } = await supabase
                .from('notifications')
                .select('*')
                .eq('user_id', session.user.id)
                .order('created_at', { ascending: false })
                .limit(20);

            if (error) {
                console.error('Failed to fetch notifications:', error);
            } else {
                setNotifications(data || []);

                // Save the latest notification timestamp to sessionStorage to clear badge instantly
                if (data && data.length > 0) {
                    sessionStorage.setItem('last_read_notifications_at', data[0].created_at);
                } else {
                    sessionStorage.setItem('last_read_notifications_at', new Date().toISOString());
                }

                // Mark ALL notifications as read (Await to ensure DB consistency before render finish)
                try {
                    const { error: readErr } = await supabase
                        .from('notifications')
                        .update({ is_read: true })
                        .eq('user_id', session.user.id)
                        .eq('is_read', false);
                    if (readErr) console.error('Failed to mark all read:', readErr);
                } catch (e) {
                    console.error('Error marking read:', e);
                }
            }
            setLoading(false);
        };

        fetchNotifications();
    }, [router]);

    const getIcon = (type: string) => {
        if (type.includes('reservation')) return <Calendar className="w-5 h-5 text-green-600" />;
        if (type.includes('community')) return <MessageSquare className="w-5 h-5 text-blue-600" />;
        return <Info className="w-5 h-5 text-stone-500" />;
    };

    return (
        <div className="min-h-screen bg-[#F7F5EF] dark:bg-black pb-20">
            {/* Header */}
            <div className="sticky top-0 z-50 bg-[#F7F5EF]/80 dark:bg-zinc-900/80 backdrop-blur-md border-b border-stone-200 dark:border-zinc-800">
                <div className="flex items-center h-14 px-4">
                    <button onClick={() => router.back()} className="p-2 -ml-2">
                        <ChevronLeft className="w-6 h-6 text-stone-800 dark:text-stone-200" />
                    </button>
                    <h1 className="text-lg font-bold text-stone-800 dark:text-stone-100 ml-2">알림 내역</h1>
                </div>
            </div>

            <main className="px-4 py-6 space-y-4">
                <div className="flex items-center gap-2 mb-4">
                    <Bell className="w-5 h-5 text-[#1C4526]" />
                    <p className="text-sm text-stone-600 dark:text-stone-400">
                        최근 알림 20건을 확인하실 수 있습니다.
                    </p>
                </div>

                {loading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                        <div key={i} className="flex gap-4 p-4 bg-white dark:bg-zinc-900 rounded-xl border border-stone-100 dark:border-zinc-800">
                            <Skeleton className="w-10 h-10 rounded-full" />
                            <div className="flex-1 space-y-2">
                                <Skeleton className="h-4 w-3/4" />
                                <Skeleton className="h-3 w-1/2" />
                            </div>
                        </div>
                    ))
                ) : notifications.length === 0 ? (
                    <div className="py-20 text-center text-stone-400">
                        <Bell className="w-12 h-12 mx-auto mb-3 opacity-20" />
                        <p>받은 알림이 없습니다.</p>
                    </div>
                ) : (
                    notifications.map((noti) => {
                        let heroImage = null;
                        let targetLink = null;
                        if (noti.data) {
                            if (typeof noti.data === 'object') {
                                heroImage = noti.data.hero_image;
                                targetLink = noti.data.route || noti.data.link;
                            } else if (typeof noti.data === 'string') {
                                try {
                                    const parsed = JSON.parse(noti.data);
                                    heroImage = parsed.hero_image;
                                    targetLink = parsed.route || parsed.link;
                                } catch (e) {}
                            }
                        }

                        return (
                            <div
                                key={noti.id}
                                onClick={() => {
                                    if (targetLink) {
                                        console.log('Navigating to:', targetLink);
                                        router.push(targetLink);
                                    }
                                }}
                                className="bg-white dark:bg-zinc-900 p-5 rounded-2xl shadow-sm border border-stone-100 dark:border-zinc-800 relative overflow-hidden active:scale-[0.98] transition-transform duration-200 cursor-pointer"
                            >
                                {/* Paper/Note Texture Effect (Optional) */}
                                <div className="absolute top-0 left-0 w-1 h-full bg-[#1C4526] opacity-80" />

                                <div className="flex items-start gap-4">
                                    <div className="mt-1 flex-shrink-0">
                                        <img 
                                            src="/icons/icon-192.png" 
                                            alt="RAON.I" 
                                            className="w-10 h-10 rounded-full border border-stone-200 object-cover" 
                                        />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex justify-between items-start mb-1">
                                            <h3 className="text-base font-bold text-stone-800 dark:text-stone-100 leading-tight">
                                                {noti.title}
                                            </h3>
                                            <div className="flex flex-col items-end ml-2">
                                                <span className="text-[10px] text-stone-400 whitespace-nowrap flex items-center gap-1">
                                                    <Clock className="w-3 h-3" />
                                                    {format(new Date(noti.created_at), 'MM.dd HH:mm', { locale: ko })}
                                                </span>
                                                {targetLink && (
                                                    <span className="text-[10px] text-[#1C4526] mt-1 font-medium bg-green-50 px-1.5 py-0.5 rounded-md">
                                                        바로가기 Available
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        <p className="text-sm text-stone-600 dark:text-stone-400 leading-relaxed whitespace-pre-wrap">
                                            {noti.body}
                                        </p>
                                        
                                        {/* Dynamic Hero Image if exists */}
                                        {heroImage && (
                                            <div className="mt-3 overflow-hidden rounded-xl border border-stone-100 dark:border-zinc-800">
                                                <img 
                                                    src={heroImage} 
                                                    alt="Camping Stay Image" 
                                                    className="w-full h-36 object-cover" 
                                                />
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })
                )}
            </main>
        </div>
    );
}
