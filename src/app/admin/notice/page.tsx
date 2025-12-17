'use client';

import { useEffect, useState } from 'react';
import { useCommunityStore, Post } from '@/store/useCommunityStore';
import { Button } from '@/components/ui/button';
import { Plus, Loader2, Eye, EyeOff } from 'lucide-react';
import Link from 'next/link';
import { format } from 'date-fns';
import { useRouter } from 'next/navigation';

export default function AdminNoticePage() {
    const { posts, loadPosts, updatePost, isLoading } = useCommunityStore();
    const [mounted, setMounted] = useState(false);
    const router = useRouter();

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setMounted(true);
        loadPosts('NOTICE');
    }, [loadPosts]);

    if (!mounted) return null;

    const handleToggleStatus = async (post: Post, e: React.MouseEvent) => {
        e.stopPropagation(); // Prevent row click
        if (!confirm(`${post.title} 공지를 ${post.status === 'CLOSED' ? '노출하시겠습니까?' : '숨기시겠습니까?'} `)) return;

        try {
            const newStatus = post.status === 'CLOSED' ? 'OPEN' : 'CLOSED';
            // Also update visibility for consistency if needed, but status is main gate
            await updatePost(post.id, {
                status: newStatus,
                // If CLOSED, set visibility PRIVATE? Maybe. But let's stick to status.
            });
            alert('상태가 변경되었습니다.');
        } catch (error: any) {
            alert(error.message);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-gray-800">공지사항 관리</h2>
                <Link href="/admin/notice/create">
                    <Button className="bg-[#1C4526] hover:bg-[#1C4526]/90 text-white">
                        <Plus className="w-4 h-4 mr-2" />
                        공지 작성
                    </Button>
                </Link>
            </div>

            <div className="bg-white rounded-lg shadow border overflow-hidden">
                <div className="grid grid-cols-12 gap-4 p-4 border-b bg-gray-50 font-medium text-sm text-gray-600">
                    <div className="col-span-1 text-center">No</div>
                    <div className="col-span-1 text-center">상태</div>
                    <div className="col-span-1 text-center">타입</div>
                    <div className="col-span-5">제목</div>
                    <div className="col-span-2 text-center">작성일</div>
                    <div className="col-span-2 text-center">관리</div>
                </div>

                {isLoading ? (
                    <div className="p-8 flex justify-center">
                        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                    </div>
                ) : posts.length === 0 ? (
                    <div className="p-8 text-center text-gray-500">
                        등록된 공지사항이 없습니다.
                    </div>
                ) : (
                    posts.map((post, index) => (
                        <div
                            key={post.id}
                            onClick={() => router.push(`/admin/notice/${post.id}`)}
                            className="grid grid-cols-12 gap-4 p-4 border-b last:border-0 items-center hover:bg-gray-50 transition-colors text-sm cursor-pointer"
                        >
                            <div className="col-span-1 text-center text-gray-500">{index + 1}</div>

                            {/* Status Badge */}
                            <div className="col-span-1 text-center">
                                <span className={`px-2 py-1 rounded text-xs font-semibold ${post.status === 'CLOSED'
                                    ? 'bg-red-100 text-red-600'
                                    : 'bg-green-100 text-green-600'
                                    }`}>
                                    {post.status === 'CLOSED' ? '중지' : '노출'}
                                </span>
                            </div>

                            <div className="col-span-1 text-center">
                                <span className="px-2 py-1 bg-gray-100 rounded text-xs text-gray-600 font-semibold">공지</span>
                            </div>

                            <div className="col-span-5 font-medium text-gray-900 truncate hover:text-[#1C4526] hover:underline">
                                {post.title}
                            </div>

                            <div className="col-span-2 text-center text-gray-500">
                                {format(new Date(post.date), 'yyyy-MM-dd')}
                            </div>

                            {/* Actions */}
                            <div className="col-span-2 text-center flex justify-center gap-2">
                                <Button
                                    size="sm"
                                    variant="outline"
                                    className={`h-8 px-2 ${post.status === 'CLOSED' ? 'text-green-600 border-green-200 hover:bg-green-50' : 'text-red-600 border-red-200 hover:bg-red-50'}`}
                                    onClick={(e) => handleToggleStatus(post, e)}
                                >
                                    {post.status === 'CLOSED' ? (
                                        <>
                                            <Eye className="w-3 h-3 mr-1" /> 재개
                                        </>
                                    ) : (
                                        <>
                                            <EyeOff className="w-3 h-3 mr-1" /> 중지
                                        </>
                                    )}
                                </Button>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
