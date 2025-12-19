'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createGroupAction } from '@/actions/group';
import { ArrowLeft, Loader2, Users } from 'lucide-react';
import Link from 'next/link';

export default function CreateGroupPage() {
    const router = useRouter();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setIsSubmitting(true);
        setError(null);

        const formData = new FormData(e.currentTarget);

        try {
            const result = await createGroupAction(formData);
            if (result.success) {
                alert('소모임방이 생성되었습니다');
                router.push('/community');
                router.refresh();
            }
        } catch (err: any) {
            setError(err.message || '소모임 생성에 실패했습니다.');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#F7F5EF]">
            {/* Header */}
            <div className="sticky top-0 bg-[#F7F5EF]/95 backdrop-blur-sm z-50 px-5 h-14 flex items-center border-b border-gray-100">
                <Link href="/community" className="p-2 -ml-2">
                    <ArrowLeft className="w-6 h-6 text-[#1C4526]" />
                </Link>
                <h1 className="text-lg font-bold text-[#1C4526] ml-2">소모임 개설</h1>
            </div>

            <main className="px-5 py-6">
                <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Image Placeholder */}
                    <div className="w-full aspect-video bg-gray-200 rounded-2xl flex flex-col items-center justify-center text-gray-500 border-2 border-dashed border-gray-300">
                        <Users className="w-10 h-10 mb-2 opacity-50" />
                        <span className="text-sm">대표 이미지 (자동설정)</span>
                    </div>

                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-[#4D4D4D] mb-1">
                                소모임 이름
                            </label>
                            <input
                                name="name"
                                type="text"
                                required
                                placeholder="예: 매너캠핑 동호회"
                                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:border-[#1C4526] bg-white"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-[#4D4D4D] mb-1">
                                소개
                            </label>
                            <textarea
                                name="description"
                                rows={4}
                                required
                                placeholder="어떤 모임인지 간단히 소개해주세요."
                                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:border-[#1C4526] bg-white resize-none"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-[#4D4D4D] mb-1">
                                최대 인원
                            </label>
                            <select
                                name="max_members"
                                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:border-[#1C4526] bg-white"
                            >
                                <option value="10">10명</option>
                                <option value="20">20명</option>
                                <option value="30">30명</option>
                                <option value="50">50명</option>
                            </select>
                        </div>
                    </div>

                    {error && (
                        <div className="text-red-500 text-sm bg-red-50 p-3 rounded-xl">
                            {error}
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={isSubmitting}
                        className="w-full bg-[#1C4526] text-white py-4 rounded-xl font-bold text-lg disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-[#1C4526]/20 active:scale-[0.98] transition-all"
                    >
                        {isSubmitting && <Loader2 className="w-5 h-5 animate-spin" />}
                        개설하기
                    </button>
                </form>
            </main>
        </div>
    );
}
