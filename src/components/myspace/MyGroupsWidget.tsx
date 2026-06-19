"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase-client';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ChevronRight, PlusCircle } from 'lucide-react';

interface MyGroup {
    group_id: string;
    group: {
        id: string;
        name: string;
        image_url: string | null;
    };
}

interface MyGroupsWidgetProps {
    isLoading?: boolean;
}

export default function MyGroupsWidget({ isLoading = false }: MyGroupsWidgetProps) {
    const [groups, setGroups] = useState<MyGroup[]>([]);
    const [loading, setLoading] = useState(true);
    const supabase = createClient();

    useEffect(() => {
        async function fetchMyGroups() {
            try {
                const { data: { user } } = await supabase.auth.getUser();
                if (!user) {
                    setLoading(false);
                    return;
                }

                const { data, error } = await supabase
                    .from('group_members')
                    .select(`
                        group_id,
                        group:groups (
                            id,
                            name,
                            image_url
                        )
                    `)
                    .eq('user_id', user.id)
                    .limit(10);

                if (error) throw error;
                // Type assertion since deep join typing can be tricky
                setGroups(data as unknown as MyGroup[]);
            } catch (err) {
                console.error('Failed to load my groups', err);
            } finally {
                setLoading(false);
            }
        }

        fetchMyGroups();
    }, []);

    // 1:1 매칭되는 정밀 스켈레톤으로 CLS 방지
    if (isLoading || loading) {
        return (
            <div className="mt-6 mb-2 animate-pulse">
                <div className="flex justify-between items-center px-7 mb-3">
                    <div className="w-20 h-5 bg-stone-200 dark:bg-stone-800 rounded-md" />
                    <div className="w-10 h-3 bg-stone-100 dark:bg-stone-800/60 rounded" />
                </div>
                <div className="flex gap-4 overflow-x-auto px-7 pb-4 scrollbar-hide">
                    <div className="flex flex-col items-center gap-2 min-w-[70px]">
                        <div className="w-[60px] h-[60px] rounded-full bg-stone-200 dark:bg-stone-800 shrink-0" />
                        <div className="w-12 h-3 bg-stone-100/60 dark:bg-stone-800/60 rounded" />
                    </div>
                    {[1, 2, 3].map((idx) => (
                        <div key={idx} className="flex flex-col items-center gap-2 min-w-[70px]">
                            <div className="w-[60px] h-[60px] rounded-full bg-stone-200 dark:bg-stone-800 shrink-0" />
                            <div className="w-12 h-3 bg-stone-100/60 dark:bg-stone-800/60 rounded" />
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    if (groups.length === 0) return null; // Hidden if empty, or "Join a group" prompt? Hiding for cleanliness per design.

    return (
        <div className="mt-6 mb-2">
            <div className="flex justify-between items-center px-7 mb-3">
                <h2 className="text-lg font-bold text-[#1A1A1A]">내 소모임</h2>
                <Link href="/community?tab=GROUP" className="text-xs text-gray-400 hover:text-[#1C4526] flex items-center">
                    더보기 <ChevronRight className="w-3 h-3" />
                </Link>
            </div>

            <div className="flex gap-4 overflow-x-auto px-7 pb-4 scrollbar-hide">
                {/* Create New / Search Entry Point */}
                <Link href="/community?tab=GROUP" className="flex flex-col items-center gap-2 min-w-[70px]">
                    <div className="w-[60px] h-[60px] rounded-full bg-[#1C4526]/5 flex items-center justify-center border border-[#1C4526]/10">
                        <PlusCircle className="w-6 h-6 text-[#1C4526]" />
                    </div>
                    <span className="text-xs text-gray-500 font-medium truncate w-full text-center">모임 찾기</span>
                </Link>

                {groups.map((item) => (
                    <Link
                        key={item.group_id}
                        href={`/community/groups/${item.group.id}`}
                        className="flex flex-col items-center gap-2 min-w-[70px]"
                    >
                        <Avatar className="w-[60px] h-[60px] border-2 border-white shadow-sm">
                            <AvatarImage src={item.group.image_url || undefined} className="object-cover" />
                            <AvatarFallback className="bg-[#1C4526] text-white text-lg font-bold">
                                {item.group.name[0]}
                            </AvatarFallback>
                        </Avatar>
                        <span className="text-xs text-[#1A1A1A] font-medium truncate w-full text-center px-1">
                            {item.group.name}
                        </span>
                    </Link>
                ))}
            </div>
        </div>
    );
}
