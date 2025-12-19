'use client';

import React, { useEffect, useState } from 'react';
import { fetchGroupsAction } from '@/actions/group';
import GroupCard from './GroupCard';
import Link from 'next/link';
import { Plus } from 'lucide-react';

export default function GroupBoard({ posts }: { posts?: any }) {
    const [groups, setGroups] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const loadGroups = async () => {
            try {
                const data = await fetchGroupsAction();
                setGroups(data || []);
            } catch (err) {
                console.error('Failed to load groups', err);
            } finally {
                setLoading(false);
            }
        };
        loadGroups();
    }, []);

    if (loading) {
        return <div className="py-20 text-center text-[#999]">로딩 중...</div>;
    }

    return (
        <div className="relative min-h-[50vh]">
            {groups.length === 0 ? (
                <div className="py-20 text-center text-[#999]">
                    <p>개설된 소모임이 없습니다. ⛺</p>
                    <p className="text-sm mt-1">첫 번째 모임장이 되어보세요!</p>
                </div>
            ) : (
                <div className="grid grid-cols-2 gap-4 pb-24">
                    {groups.map((group) => (
                        <GroupCard key={group.id} group={group} />
                    ))}
                </div>
            )}

            {/* Floating Action Button for Create Group */}
            {/* Floating Action Button for Create Group */}
            <div className="fixed bottom-32 left-0 right-0 mx-auto w-full max-w-[430px] px-5 flex justify-end z-50 pointer-events-none">
                <Link
                    href="/community/groups/new"
                    className="pointer-events-auto bg-[#1C4526] text-white h-12 px-6 rounded-full shadow-xl flex items-center gap-2 active:scale-95 transition-transform hover:bg-[#14331C]"
                >
                    <Plus className="w-5 h-5" />
                    <span className="font-bold text-sm">소모임 만들기</span>
                </Link>
            </div>
        </div>
    );
}
