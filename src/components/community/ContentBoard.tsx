"use client";

import React from 'react';
import { Post } from '@/store/useCommunityStore';
import { ContentBoardList } from './content/ContentBoardList';
import { useRouter } from 'next/navigation';
import { PenTool } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ContentBoardProps {
    posts: Post[]; // Not used, as ContentBoardList fetches its own data from creator_contents table
}

export default function ContentBoard({ posts }: ContentBoardProps) {
    const router = useRouter();

    return (
        <div className="pb-20 relative">
            <div className="flex justify-end px-4 mb-4">
                <Button
                    onClick={() => router.push('/community/content/create')}
                    className="bg-[#1C4526] hover:bg-[#15331d] text-white rounded-full shadow-lg"
                >
                    <PenTool className="w-4 h-4 mr-2" />
                    콘텐츠 발행하기 (창작자 전용)
                </Button>
            </div>
            <ContentBoardList />
        </div>
    );
}
