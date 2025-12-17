'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { useCommunityStore } from '@/store/useCommunityStore';
import { ArrowLeft, Grid, LayoutList, Heart, MessageCircle } from 'lucide-react';
import Image from 'next/image';

export default function MyRecordPage() {
    const router = useRouter();
    const { getMyPosts, currentUser } = useCommunityStore();
    const myPosts = getMyPosts();

    return (
        <div className="min-h-screen bg-gray-50 pb-20">
            {/* Header */}
            <div className="bg-white sticky top-0 z-10 border-b px-4 h-[56px] flex items-center justify-between">
                <button onClick={() => router.back()} className="p-2 -ml-2">
                    <ArrowLeft className="w-6 h-6 text-gray-800" />
                </button>
                <h1 className="text-lg font-bold text-gray-900">나의 기록</h1>
                <div className="w-8" /> {/* Spacer */}
            </div>

            {/* Profile Summary (Simple) */}
            <div className="bg-white p-6 mb-2">
                <div className="flex flex-col items-center">
                    <div className="w-20 h-20 rounded-full bg-gray-200 mb-3 overflow-hidden relative">
                        {/* Placeholder Avatar */}
                        <div className="absolute inset-0 flex items-center justify-center text-2xl font-bold text-gray-400">
                            {currentUser.name[0]}
                        </div>
                    </div>
                    <h2 className="text-xl font-bold text-gray-900">{currentUser.name}</h2>
                    <p className="text-sm text-gray-500 mt-1">
                        작성한 이야기 <span className="text-[#1C4526] font-bold">{myPosts.length}</span>개
                    </p>
                </div>
            </div>

            {/* Content Grid */}
            <div className="grid grid-cols-3 gap-0.5">
                {myPosts.length > 0 ? (
                    myPosts.map((post) => (
                        <div
                            key={post.id}
                            onClick={() => router.push(`/community/${post.id}`)}
                            className="aspect-square relative bg-white cursor-pointer group"
                        >
                            {post.images && post.images.length > 0 ? (
                                <Image
                                    src={post.images[0]}
                                    alt={post.title}
                                    fill
                                    className="object-cover"
                                />
                            ) : (
                                <div className="w-full h-full bg-gray-100 flex flex-col items-center justify-center p-2 text-center">
                                    <span className="text-xs text-gray-400 line-clamp-3">{post.content}</span>
                                </div>
                            )}

                            {/* Overlay Stats (Optional) */}
                            {/* <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white gap-3 transition-opacity">
                                <span className="flex items-center text-sm font-bold"><Heart className="w-4 h-4 mr-1 fill-white" />{post.likeCount}</span>
                                <span className="flex items-center text-sm font-bold"><MessageCircle className="w-4 h-4 mr-1 fill-white" />{post.commentCount}</span>
                            </div> */}
                        </div>
                    ))
                ) : (
                    <div className="col-span-3 py-20 text-center text-gray-400">
                        <p>아직 작성한 기록이 없습니다.</p>
                        <button
                            onClick={() => router.push('/community/write?type=STORY')}
                            className="mt-4 px-6 py-2 bg-[#1C4526] text-white rounded-full text-sm font-bold"
                        >
                            첫 기록 남기기
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
