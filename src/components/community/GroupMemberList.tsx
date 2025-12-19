'use client';

import React, { useState, useTransition } from 'react';
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
    SheetTrigger,
} from "@/components/ui/sheet";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { LogOut, MoreVertical, Shield, User } from 'lucide-react';
import { leaveGroupAction } from '@/actions/group';
import { useRouter } from 'next/navigation';

export interface GroupMember {
    id: string;
    user_id: string;
    role: string;
    joined_at: string;
    user: {
        id: string;
        email: string;
        display_name: string;
        avatar_url: string;
    };
    members?: { count: number };
}

interface Props {
    groupId: string;
    members: GroupMember[];
    currentUserId?: string;
    children: React.ReactNode;
}

export default function GroupMemberList({ groupId, members, currentUserId, children }: Props) {
    const [isPending, startTransition] = useTransition();
    const router = useRouter();
    const [isOpen, setIsOpen] = useState(false);

    const handleLeave = async () => {
        if (!confirm('정말로 이 소모임을 탈퇴하시겠습니까?')) return;

        startTransition(async () => {
            const result = await leaveGroupAction(groupId);
            if (result.success) {
                setIsOpen(false);
                // Router refresh is handled in action revalidatePath, 
                // but typically we might want to redirect to list if strictly needed.
                // For now, revalidatePath updates state, user becomes non-member.
            } else {
                alert('탈퇴 실패: ' + result.error);
            }
        });
    };

    return (
        <Sheet open={isOpen} onOpenChange={setIsOpen}>
            <SheetTrigger asChild>
                <div className="cursor-pointer hover:opacity-80 transition-opacity">
                    {children}
                </div>
            </SheetTrigger>
            <SheetContent side="bottom" className="h-[80vh] rounded-t-3xl p-0 bg-[#F7F5EF] max-w-[430px] mx-auto left-0 right-0">
                <div className="p-6 h-full flex flex-col">
                    <SheetHeader className="mb-6 text-left">
                        <SheetTitle className="text-[#1C4526] text-xl font-bold">멤버 목록</SheetTitle>
                        <SheetDescription>
                            함께하는 멤버 {members.length}명
                        </SheetDescription>
                    </SheetHeader>

                    <div className="flex-1 overflow-y-auto space-y-4 pr-2">
                        {members.map((member) => {
                            const isMe = currentUserId === member.user_id;
                            const isOwner = member.role === 'owner';

                            return (
                                <div key={member.id} className="flex items-center justify-between bg-white p-3 rounded-xl shadow-sm border border-gray-100">
                                    <div className="flex items-center gap-3">
                                        <Avatar className="h-10 w-10 border border-gray-100">
                                            <AvatarImage src={member.user?.avatar_url} />
                                            <AvatarFallback className="bg-[#1C4526]/10 text-[#1C4526]">
                                                {member.user?.display_name?.[0] || 'U'}
                                            </AvatarFallback>
                                        </Avatar>
                                        <div>
                                            <div className="flex items-center gap-1.5">
                                                <p className="font-semibold text-[#1A1A1A] text-sm">
                                                    {member.user?.display_name || '알 수 없음'}
                                                </p>
                                                {isOwner && (
                                                    <span className="text-[10px] bg-[#C3A675] text-white px-1.5 py-0.5 rounded-full font-medium">
                                                        모임장
                                                    </span>
                                                )}
                                                {isMe && (
                                                    <span className="text-[10px] bg-[#1C4526] text-white px-1.5 py-0.5 rounded-full font-medium">
                                                        나
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-xs text-gray-400">
                                                {new Date(member.joined_at).toLocaleDateString()} 가입
                                            </p>
                                        </div>
                                    </div>

                                    {isMe && !isOwner && (
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={handleLeave}
                                            disabled={isPending}
                                            className="text-red-500 hover:text-red-600 hover:bg-red-50 h-8 px-2"
                                        >
                                            <LogOut className="w-4 h-4 mr-1" />
                                            탈퇴
                                        </Button>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            </SheetContent>
        </Sheet>
    );
}
