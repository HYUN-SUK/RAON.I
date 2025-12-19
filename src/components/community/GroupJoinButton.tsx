'use client';

import React, { useTransition } from 'react';
import { joinGroupAction } from '@/actions/group';
import { UserPlus, Loader2, LogOut } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface Props {
    groupId: string;
    isJoined: boolean;
}

export default function GroupJoinButton({ groupId, isJoined }: Props) {
    const [isPending, startTransition] = useTransition();
    const router = useRouter();

    const handleJoin = async () => {
        if (isPending) return;

        startTransition(async () => {
            try {
                const result = await joinGroupAction(groupId);
                if (result.success) {
                    // Success feedback?
                } else {
                    alert('가입에 실패했습니다: ' + result.error);
                }
            } catch (e) {
                alert('오류가 발생했습니다.');
            }
        });
    };

    // If implementing Leave, we need leaveGroupAction. For now just Join.

    if (isJoined) {
        return (
            <button
                disabled
                className="flex-1 bg-gray-100 text-gray-400 font-bold py-3.5 rounded-xl flex items-center justify-center gap-2 cursor-not-allowed"
            >
                <UserPlus className="w-5 h-5" />
                이미 가입함
            </button>
        );
    }

    return (
        <button
            onClick={handleJoin}
            disabled={isPending}
            className="flex-1 bg-[#1C4526] text-white font-bold py-3.5 rounded-xl shadow-lg active:scale-[0.98] transition-transform flex items-center justify-center gap-2 disabled:opacity-70"
        >
            {isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : <UserPlus className="w-5 h-5" />}
            가입하기
        </button>
    );
}
