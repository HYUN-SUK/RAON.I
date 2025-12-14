'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { BoardType } from '@/store/useCommunityStore';

interface CommunityTabsProps {
    activeTab: BoardType;
    onTabChange: (tab: BoardType) => void;
}

const TABS: { id: BoardType; label: string }[] = [
    { id: 'NOTICE', label: '공지' },
    { id: 'REVIEW', label: '후기' },
    { id: 'STORY', label: '이야기' },
    { id: 'QNA', label: '질문' },
    { id: 'GROUP', label: '소모임' },
    { id: 'CONTENT', label: '콘텐츠' },
];

export default function CommunityTabs({ activeTab, onTabChange }: CommunityTabsProps) {
    return (
        <div className="w-full overflow-x-auto no-scrollbar px-5">
            <div className="flex gap-2">
                {TABS.map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => onTabChange(tab.id)}
                        className={cn(
                            "px-4 py-2 rounded-full text-sm font-medium transition-colors whitespace-nowrap",
                            activeTab === tab.id
                                ? "bg-[#1C4526] text-white shadow-md"
                                : "bg-white text-[#4D4D4D] border border-[#E5E5E5]"
                        )}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>
        </div>
    );
}
