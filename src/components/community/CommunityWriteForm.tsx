'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { BoardType, useCommunityStore } from '@/store/useCommunityStore';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Loader2 } from 'lucide-react';

const CATEGORIES: { id: BoardType; label: string }[] = [
    { id: 'NOTICE', label: '공지 (관리자)' },
    { id: 'REVIEW', label: '후기' },
    { id: 'STORY', label: '이야기' },
    { id: 'QNA', label: '질문' },
    { id: 'GROUP', label: '소모임' },
    { id: 'CONTENT', label: '콘텐츠' },
];

export default function CommunityWriteForm() {
    const router = useRouter();
    const { createPost, isLoading } = useCommunityStore();

    const [type, setType] = useState<BoardType>('STORY');
    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');

    // Extra fields
    const [groupName, setGroupName] = useState('');
    const [videoUrl, setVideoUrl] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!title.trim() || !content.trim()) return;

        try {
            await createPost({
                type,
                title,
                content,
                // Mock author for now
                author: 'Current User',
                images: [], // TODO: Image upload
                groupName: type === 'GROUP' ? groupName : undefined,
                videoUrl: type === 'CONTENT' ? videoUrl : undefined,
            });

            // Go back to list
            router.back();
        } catch (error) {
            alert('Failed to post');
        }
    };

    return (
        <div className="min-h-screen bg-white">
            {/* Header */}
            <div className="flex items-center h-[56px] px-4 border-b">
                <button onClick={() => router.back()} className="mr-4">
                    <ArrowLeft className="w-6 h-6 text-[#1A1A1A]" />
                </button>
                <h1 className="text-lg font-bold text-[#1A1A1A]">글쓰기</h1>
                <Button
                    onClick={handleSubmit}
                    disabled={isLoading || !title || !content}
                    variant="ghost"
                    className="ml-auto text-[#1C4526] font-bold"
                >
                    {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : '완료'}
                </Button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="p-5 space-y-6">
                {/* Category Select */}
                <div className="space-y-2">
                    <label className="text-sm font-medium text-[#4D4D4D]">게시판 선택</label>
                    <Select value={type} onValueChange={(val) => setType(val as BoardType)}>
                        <SelectTrigger>
                            <SelectValue placeholder="게시판을 선택하세요" />
                        </SelectTrigger>
                        <SelectContent>
                            {CATEGORIES.map((cat) => (
                                <SelectItem key={cat.id} value={cat.id}>{cat.label}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                {/* Dynamic Fields */}
                {type === 'GROUP' && (
                    <Input
                        placeholder="소모임 이름 (예: 찰칵)"
                        value={groupName}
                        onChange={(e) => setGroupName(e.target.value)}
                    />
                )}
                {type === 'CONTENT' && (
                    <Input
                        placeholder="영상 URL 입력 (Youtube...)"
                        value={videoUrl}
                        onChange={(e) => setVideoUrl(e.target.value)}
                    />
                )}

                {/* Title */}
                <Input
                    placeholder="제목을 입력하세요"
                    className="text-lg font-medium border-none px-0 shadow-none focus-visible:ring-0 placeholder:text-[#999]"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                />

                {/* Content */}
                <Textarea
                    placeholder="캠퍼들과 나누고 싶은 이야기를 적어주세요."
                    className="min-h-[300px] resize-none border-none px-0 shadow-none focus-visible:ring-0 text-base placeholder:text-[#999]"
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                />
            </form>
        </div>
    );
}
