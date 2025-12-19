import React from 'react';
import { createClient } from '@/lib/supabase-server';
import { ArrowLeft, Users, UserPlus } from 'lucide-react';
import Link from 'next/link';
import GroupJoinButton from '@/components/community/GroupJoinButton';

import { getGroupPostsAction } from '@/actions/group-post';
import { getGroupMembersAction } from '@/actions/group';
import GroupFeed from '@/components/community/GroupFeed';
import GroupMemberList from '@/components/community/GroupMemberList';

// Since this is a server component, we fetch directly
export default async function GroupDetailPage(props: { params: Promise<{ id: string }> }) {
    const supabase = await createClient();
    const params = await props.params;
    const { id } = params;

    const { data: { user } } = await supabase.auth.getUser();

    // Fetch Group Info
    const { data: group, error } = await supabase
        .from('groups')
        .select('*')
        .eq('id', id)
        .single();

    if (error || !group) {
        return (
            <div className="py-20 text-center text-[#999]">
                <p>소모임을 찾을 수 없습니다.</p>
                <Link href="/community" className="text-sm underline mt-2 block">목록으로 돌아가기</Link>
            </div>
        );
    }

    // Parallel Fetching for Efficiency
    const [posts, members, memberCheck] = await Promise.all([
        getGroupPostsAction(id),
        getGroupMembersAction(id),
        user ? supabase.from('group_members').select('id').eq('group_id', id).eq('user_id', user.id).maybeSingle() : Promise.resolve({ data: null })
    ]);

    // Check Membership
    const isMember = !!memberCheck.data;

    return (
        <div className="min-h-screen bg-[#F7F5EF] pb-40">
            {/* Hero Header */}
            <div className="relative h-64 w-full bg-gray-800">
                {group.image_url && (
                    <img
                        src={group.image_url}
                        alt={group.name}
                        className="w-full h-full object-cover opacity-70"
                    />
                )}
                <div className="absolute top-0 left-0 w-full p-5 flex items-start justify-between">
                    <Link href="/community" className="text-white bg-black/20 p-2 rounded-full backdrop-blur-md">
                        <ArrowLeft className="w-6 h-6" />
                    </Link>
                </div>

                <div className="absolute bottom-0 left-0 w-full p-5 bg-gradient-to-t from-black/80 to-transparent">
                    <h1 className="text-2xl font-bold text-white mb-2">{group.name}</h1>

                    {/* Member List Trigger */}
                    <GroupMemberList groupId={id} members={members} currentUserId={user?.id}>
                        <div className="flex items-center gap-2 text-white/90 text-sm hover:bg-white/10 p-1 rounded-lg transition-colors inline-flex">
                            <Users className="w-4 h-4" />
                            {/* If members list is empty but I am a member, show at least 1, otherwise show actual length.
                                The issue is likely RLS filtering members list for others. */}
                            <span>멤버 {Math.max(members.length, isMember ? 1 : 0)}명</span>
                            <span className="text-white/60">•</span>
                            <span>개설일 {new Date(group.created_at).toLocaleDateString()}</span>
                        </div>
                    </GroupMemberList>
                </div>
            </div>

            {/* Content Body */}
            <main className="px-5 py-6 space-y-8">
                {/* Description */}
                <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
                    <h2 className="font-bold text-[#1C4526] mb-2">모임 소개</h2>
                    <p className="text-[#4D4D4D] whitespace-pre-wrap leading-relaxed text-sm">
                        {group.description}
                    </p>
                </div>

                {/* Feed Section */}
                <div>
                    <h2 className="font-bold text-lg text-[#1C4526] mb-4 px-1">게시글</h2>
                    <GroupFeed
                        groupId={id}
                        posts={posts}
                        currentUserId={user?.id}
                        isMember={isMember}
                    />
                </div>
            </main>

            {/* Bottom Action Bar (Only if NOT member) */}
            {!isMember && (
                <div className="fixed bottom-[84px] w-full bg-white border-t border-gray-200 p-4 flex gap-3 max-w-md mx-auto left-0 right-0 z-50">
                    <GroupJoinButton groupId={id} isJoined={isMember} />
                </div>
            )}
        </div>
    );
}
