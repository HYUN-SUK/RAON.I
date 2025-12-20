"use client";

import React, { useEffect, useState } from 'react';
import { creatorService } from '@/services/creatorService';
import { CreatorContent, Creator, CreatorEpisode, CreatorContentStatus } from '@/types/creator';
import { useRouter } from 'next/navigation'; // import useParams is not available in next 15 client comp directly? Use props or use useParams
// In Next.js App Router, page receives params prop. But for Client Component we can use useParams also if imported from next/navigation? 
// Actually 'useParams' is available.
import { useParams } from 'next/navigation';
import { Loader2, ArrowLeft, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';
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

        } catch (e: any) {
            console.error(e);
            alert(`처리 실패: ${e.message}`);
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
                            {content.cover_image_url && <img src={content.cover_image_url} className="w-full h-full object-cover" />}
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
                                승인 시 즉시 사용자 앱('콘텐츠' 탭)에 노출됩니다.
                            </p>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
}
