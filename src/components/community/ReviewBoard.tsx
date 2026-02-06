'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Post } from '@/store/useCommunityStore';
import PostCard from './PostCard';
import { sanitizePost } from '@/utils/communityUtils';
import { CampingRecord, getPublicRecords } from '@/actions/record';
import AjiitCard from '@/components/record/AjiitCard';
import { Loader2, Tent, MapPin } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BoardProps {
    posts: Post[];
}

type ReviewTab = 'RAONAI' | 'CAMPER';

export default function ReviewBoard({ posts }: BoardProps) {
    const rawPosts = Array.isArray(posts) ? posts : [];
    const safePosts = rawPosts.map(sanitizePost);

    const [activeTab, setActiveTab] = useState<ReviewTab>('RAONAI');
    const [records, setRecords] = useState<CampingRecord[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    const fetchRecords = useCallback(async () => {
        setIsLoading(true);
        try {
            const type = activeTab === 'RAONAI' ? 'raonai' : 'external';
            const data = await getPublicRecords(type, 20, 0);
            setRecords(data);
        } catch (error) {
            console.error('Failed to fetch records:', error);
        } finally {
            setIsLoading(false);
        }
    }, [activeTab]);

    useEffect(() => {
        fetchRecords();
    }, [fetchRecords]);

    return (
        <div className="space-y-4 pb-20">
            {/* 탭 네비게이션 */}
            <div className="flex p-1 bg-stone-100 rounded-lg">
                <button
                    onClick={() => setActiveTab('RAONAI')}
                    className={cn(
                        "flex-1 flex items-center justify-center gap-2 py-2.5 rounded-md text-sm font-medium transition-all",
                        activeTab === 'RAONAI'
                            ? "bg-white text-[#224732] shadow-sm"
                            : "text-stone-500 hover:text-stone-700"
                    )}
                >
                    <Tent className="w-4 h-4" />
                    라온아이 후기
                </button>
                <button
                    onClick={() => setActiveTab('CAMPER')}
                    className={cn(
                        "flex-1 flex items-center justify-center gap-2 py-2.5 rounded-md text-sm font-medium transition-all",
                        activeTab === 'CAMPER'
                            ? "bg-white text-[#224732] shadow-sm"
                            : "text-stone-500 hover:text-stone-700"
                    )}
                >
                    <MapPin className="w-4 h-4" />
                    캠퍼 후기
                </button>
            </div>

            {/* 컨텐츠 영역 */}
            {isLoading ? (
                <div className="py-20 flex justify-center">
                    <Loader2 className="w-8 h-8 animate-spin text-[#224732]" />
                </div>
            ) : (
                <div className="space-y-6">
                    {/* 라온아이 탭일 경우 기존 Post (Community Review) 표시 (옵션) */}
                    {activeTab === 'RAONAI' && safePosts.length > 0 && (
                        <div className="space-y-4">
                            {safePosts.map((post) => (
                                <PostCard key={post.id} post={post} />
                            ))}
                            {records.length > 0 && <hr className="border-stone-200" />}
                        </div>
                    )}

                    {/* 1분 기록 (Camping Records) 표시 */}
                    {records.length > 0 ? (
                        <div className="grid gap-6">
                            {records.map((record) => (
                                <AjiitCard
                                    key={record.id}
                                    record={{
                                        ...record,
                                        campground_name: record.campground_name,
                                        campground_address: record.campground_address,
                                    }}
                                />
                            ))}
                        </div>
                    ) : (
                        // Post도 없고 Record도 없을 때
                        activeTab === 'RAONAI' && safePosts.length === 0 ? (
                            <div className="py-20 text-center text-[#999]">
                                <p>아직 작성된 후기가 없습니다. 📝</p>
                                <p className="text-sm mt-1">첫 번째 후기의 주인공이 되어보세요!</p>
                            </div>
                        ) : activeTab === 'CAMPER' && (
                            <div className="py-20 text-center text-[#999]">
                                <p>아직 등록된 캠퍼 후기가 없습니다.</p>
                                <p className="text-sm mt-1">다녀온 캠핑장의 이야기를 들려주세요!</p>
                            </div>
                        )
                    )}
                </div>
            )}
        </div>
    );
}
