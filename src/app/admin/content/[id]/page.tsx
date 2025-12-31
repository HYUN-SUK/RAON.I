"use client";

import React, { useEffect, useState } from 'react';
import { creatorService } from '@/services/creatorService';
import { CreatorContent, Creator, CreatorEpisode, CreatorContentStatus, CreatorComment } from '@/types/creator'; // Added CreatorComment
import { useRouter } from 'next/navigation';
import { useParams } from 'next/navigation';
import { Loader2, ArrowLeft, CheckCircle, XCircle, AlertTriangle, Trash2 } from 'lucide-react'; // Added Trash2
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export default function AdminContentReviewPage() {
    const router = useRouter();
    const params = useParams(); // { id: string }
    const id = params?.id as string;

    const [content, setContent] = useState<(CreatorContent & { creators: Creator }) | null>(null);
    const [episodes, setEpisodes] = useState<CreatorEpisode[]>([]);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);

    useEffect(() => {
        if (id) fetchData();
    }, [id]);

    const fetchData = async () => {
        try {
            setLoading(true);
            const [c, e] = await Promise.all([
                creatorService.getContentById(id),
                creatorService.getEpisodes(id)
            ]);
            setContent(c);
            setEpisodes(e);
        } catch (error) {
            console.error(error);
            alert('데이터 로드 실패');
        } finally {
            setLoading(false);
        }
    };



    const [reviewDialog, setReviewDialog] = useState<{ isOpen: boolean, status: CreatorContentStatus } | null>(null);

    const openReviewDialog = (status: CreatorContentStatus) => {
        setReviewDialog({ isOpen: true, status });
    };

    const closeReviewDialog = () => {
        setReviewDialog(null);
    };

    const handleProcessReview = async () => {
        if (!reviewDialog) return;
        const { status } = reviewDialog;

        try {
            setActionLoading(true);

            // Update Content & Episodes using service
            await creatorService.updateContent(id, {
                status,
                published_at: status === 'PUBLISHED' ? new Date().toISOString() : null
            });

            await creatorService.updateEpisodeStatus(id, status);

            alert(status === 'PUBLISHED' ? '콘텐츠가 성공적으로 발행되었습니다.' : '반려 처리되었습니다.');

            // Close dialog first
            closeReviewDialog();

            // Redirect to the new Community Management page
            router.push('/admin/community');
            router.refresh();

        } catch (e: unknown) {
            console.error(e);
            alert(`처리 실패: ${e instanceof Error ? e.message : 'Unknown error'}`);
        } finally {
            setActionLoading(false);
        }
    };

    if (loading) return <div className="p-10 text-center"><Loader2 className="animate-spin inline" /></div>;
    if (!content) return <div>Not found</div>;

    return (
        <div className="p-6 max-w-5xl mx-auto relative">
            {/* Review Dialog */}
            {reviewDialog && reviewDialog.isOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <div className="bg-white p-6 rounded-2xl shadow-2xl w-full max-w-md animate-in zoom-in-95 duration-200">
                        <h3 className="text-xl font-bold text-gray-900 mb-2">
                            {reviewDialog.status === 'PUBLISHED' ? '콘텐츠 승인' : '콘텐츠 반려'}
                        </h3>
                        <p className="text-gray-600 mb-6 text-sm leading-relaxed">
                            <span className="font-semibold text-gray-900">{content.title}</span><br />
                            {reviewDialog.status === 'PUBLISHED'
                                ? '이 콘텐츠를 승인하시겠습니까? 승인 즉시 사용자 앱에 공개됩니다.'
                                : '이 콘텐츠를 반려하시겠습니까? 반려 사유는 별도로 전달해주세요.'}
                        </p>

                        <div className="flex gap-3 justify-end">
                            <Button
                                variant="outline"
                                onClick={closeReviewDialog}
                                className="flex-1"
                            >
                                취소
                            </Button>
                            <Button
                                variant={reviewDialog.status === 'REJECTED' ? "destructive" : "default"}
                                onClick={handleProcessReview}
                                disabled={actionLoading}
                                className={reviewDialog.status === 'PUBLISHED' ? "flex-1 bg-[#1C4526] hover:bg-[#15341d] text-white" : "flex-1 bg-red-50 text-red-600 hover:bg-red-100 border-none shadow-none"}
                            >
                                {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : (reviewDialog.status === 'PUBLISHED' ? '승인 (발행)' : '반려')}
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            <button onClick={() => router.back()} className="flex items-center text-gray-500 mb-6 hover:text-gray-900">
                <ArrowLeft className="w-4 h-4 mr-1" /> 목록으로 돌아가기
            </button>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">

                {/* Left: Content Info */}
                <div className="md:col-span-2 space-y-6">
                    <div className="bg-white p-6 rounded-xl shadow-sm border space-y-4">
                        <div className="flex justify-between items-start">
                            <div>
                                <Badge className="mb-2">{content.type}</Badge>
                                <h1 className="text-2xl font-bold">{content.title}</h1>
                            </div>
                            <Badge variant="outline">{content.status}</Badge>
                        </div>

                        <div className="aspect-video relative bg-gray-100 rounded-lg overflow-hidden">
                            {content.cover_image_url && <img src={content.cover_image_url} alt={content.title} className="w-full h-full object-cover" />}
                        </div>

                        <div className="prose max-w-none">
                            <h3 className="text-lg font-bold">소개</h3>
                            <p className="whitespace-pre-wrap text-gray-600">{content.description || '내용 없음'}</p>
                        </div>
                    </div>

                    <div className="bg-white p-6 rounded-xl shadow-sm border">
                        <h3 className="text-lg font-bold mb-4">에피소드 목록 ({episodes.length})</h3>
                        <div className="space-y-4">
                            {episodes.map(ep => (
                                <div key={ep.id} className="border p-4 rounded-lg">
                                    <div className="font-bold text-lg mb-2">{ep.title}</div>
                                    <div className="bg-gray-50 p-3 rounded text-sm font-mono whitespace-pre-wrap max-h-40 overflow-y-auto">
                                        {JSON.stringify(ep.body_ref, null, 2)}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <AdminCommentList contentId={id} />
                </div>

                {/* Right: Actions */}
                <div className="space-y-6">
                    <div className="bg-white p-6 rounded-xl shadow-sm border sticky top-6">
                        <h3 className="font-bold text-gray-900 mb-4">심사 액션</h3>
                        <div className="space-y-3">
                            <Button
                                className="w-full bg-[#1C4526] hover:bg-[#15331d]"
                                onClick={() => openReviewDialog('PUBLISHED')}
                                disabled={actionLoading}
                            >
                                <CheckCircle className="w-4 h-4 mr-2" />
                                승인 및 발행
                            </Button>
                            <Button
                                className="w-full"
                                variant="destructive"
                                onClick={() => openReviewDialog('REJECTED')}
                                disabled={actionLoading}
                            >
                                <XCircle className="w-4 h-4 mr-2" />
                                반려 (Reject)
                            </Button>
                        </div>
                        <div className="mt-6 text-xs text-gray-500">
                            <p className="flex items-start gap-1">
                                <AlertTriangle className="w-3 h-3 mt-0.5" />
                                승인 시 즉시 사용자 앱(&apos;콘텐츠&apos; 탭)에 노출됩니다.
                            </p>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
}

function AdminCommentList({ contentId }: { contentId: string }) {
    const [comments, setComments] = useState<CreatorComment[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadComments();
    }, [contentId]);

    const loadComments = async () => {
        try {
            setLoading(true);
            const data = await creatorService.getComments(contentId);
            setComments(data);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (commentId: string) => {
        if (!confirm('정말 이 댓글을 삭제하시겠습니까? (복구 불가)')) return;
        try {
            await creatorService.adminDeleteComment(commentId);
            alert('삭제되었습니다.');
            loadComments(); // Refresh
        } catch (e) {
            console.error(e);
            alert('삭제 실패');
        }
    };

    if (loading) return <div className="p-4 text-center text-gray-500">댓글 로딩 중...</div>;

    return (
        <div className="bg-white p-6 rounded-xl shadow-sm border">
            <h3 className="text-lg font-bold mb-4">댓글 목록 ({comments.length})</h3>
            <div className="space-y-4 max-h-96 overflow-y-auto">
                {comments.length === 0 ? (
                    <p className="text-gray-500 text-sm">댓글이 없습니다.</p>
                ) : (
                    comments.map((comment) => (
                        <div key={comment.id} className="flex justify-between items-start border-b pb-3 last:border-0 last:pb-0">
                            <div>
                                <div className="text-sm font-semibold text-gray-800 mb-1">
                                    {comment.user_email || '익명 사용자'}
                                    <span className="text-xs text-gray-400 font-normal ml-2">
                                        {new Date(comment.created_at).toLocaleString()}
                                    </span>
                                </div>
                                <p className="text-sm text-gray-700">{comment.content}</p>
                            </div>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDelete(comment.id)}
                                className="text-red-500 hover:text-red-700 hover:bg-red-50"
                            >
                                <Trash2 className="w-4 h-4" />
                            </Button>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
