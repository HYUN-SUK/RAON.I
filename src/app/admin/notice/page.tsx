'use client';

import { useEffect, useState } from 'react';
import { useCommunityStore, Post } from '@/store/useCommunityStore';
import { communityService } from '@/services/communityService';
import { Button } from '@/components/ui/button';
import { Plus, Loader2, Eye, EyeOff, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { format } from 'date-fns';
import { useRouter } from 'next/navigation';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';

export default function AdminNoticePage() {
    const { posts, loadPosts, updatePost, isLoading } = useCommunityStore();
    const [mounted, setMounted] = useState(false);
    const [actionTarget, setActionTarget] = useState<{ post: Post; action: 'toggle' | 'delete' } | null>(null);
    const [processing, setProcessing] = useState(false);
    const router = useRouter();

    useEffect(() => {
        setMounted(true);
        loadPosts('NOTICE');
    }, [loadPosts]);

    if (!mounted) return null;

    const handleToggleStatus = async () => {
        if (!actionTarget || actionTarget.action !== 'toggle') return;
        const post = actionTarget.post;
        setProcessing(true);
        try {
            const newStatus = post.status === 'CLOSED' ? 'OPEN' : 'CLOSED';
            await updatePost(post.id, { status: newStatus });
            loadPosts('NOTICE'); // 리스트 새로고침
            setActionTarget(null);
        } catch (error) {
            alert(error instanceof Error ? error.message : 'Unknown error');
        } finally {
            setProcessing(false);
        }
    };

    const handleDelete = async () => {
        if (!actionTarget || actionTarget.action !== 'delete') return;
        setProcessing(true);
        try {
            await communityService.deletePost(actionTarget.post.id);
            loadPosts('NOTICE'); // 리스트 새로고침
            setActionTarget(null);
        } catch (error) {
            alert(error instanceof Error ? error.message : 'Unknown error');
        } finally {
            setProcessing(false);
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
                                    className={`h-8 px-2 ${post.status === 'CLOSED' ? 'text-green-600 border-green-200 hover:bg-green-50' : 'text-orange-600 border-orange-200 hover:bg-orange-50'}`}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setActionTarget({ post, action: 'toggle' });
                                    }}
                                >
                                    {post.status === 'CLOSED' ? (
                                        <><Eye className="w-3 h-3 mr-1" /> 재개</>
                                    ) : (
                                        <><EyeOff className="w-3 h-3 mr-1" /> 중지</>
                                    )}
                                </Button>
                                <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-8 px-2 text-red-600 border-red-200 hover:bg-red-50"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setActionTarget({ post, action: 'delete' });
                                    }}
                                >
                                    <Trash2 className="w-3 h-3 mr-1" /> 삭제
                                </Button>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* 노출중지/재개 Dialog */}
            <AlertDialog open={actionTarget?.action === 'toggle'} onOpenChange={(open) => !open && setActionTarget(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>
                            {actionTarget?.post.status === 'CLOSED' ? '공지 재개' : '공지 노출 중지'}
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            <span className="font-bold text-gray-900">{actionTarget?.post.title}</span> 공지를{' '}
                            {actionTarget?.post.status === 'CLOSED' ? '다시 노출하시겠습니까?' : '숨기시겠습니까?'}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={processing}>취소</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleToggleStatus}
                            disabled={processing}
                            className={actionTarget?.post.status === 'CLOSED' ? 'bg-green-600 hover:bg-green-700' : 'bg-orange-500 hover:bg-orange-600'}
                        >
                            {processing && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                            {actionTarget?.post.status === 'CLOSED' ? '재개' : '중지'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* 삭제 Dialog */}
            <AlertDialog open={actionTarget?.action === 'delete'} onOpenChange={(open) => !open && setActionTarget(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>공지 삭제</AlertDialogTitle>
                        <AlertDialogDescription>
                            정말 <span className="font-bold text-gray-900">{actionTarget?.post.title}</span> 공지를 삭제하시겠습니까?
                            <br />이 작업은 되돌릴 수 없습니다.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={processing}>취소</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleDelete}
                            disabled={processing}
                            className="bg-red-500 hover:bg-red-600"
                        >
                            {processing && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                            삭제
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
