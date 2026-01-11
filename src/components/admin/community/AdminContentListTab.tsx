"use client";

import React, { useEffect, useState } from 'react';
import { creatorService } from '@/services/creatorService';
import { CreatorContent, Creator, CreatorContentStatus } from '@/types/creator';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
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

export function AdminContentListTab() {
    const router = useRouter();
    const [contents, setContents] = useState<(CreatorContent & { creators: Creator })[]>([]);
    const [loading, setLoading] = useState(true);
    const [statusFilter, setStatusFilter] = useState<CreatorContentStatus>('PENDING_REVIEW');
    const [deleteTarget, setDeleteTarget] = useState<CreatorContent | null>(null);
    const [deleting, setDeleting] = useState(false);

    useEffect(() => {
        fetchContents();
    }, [statusFilter]);

    const fetchContents = async () => {
        try {
            setLoading(true);
            const data = await creatorService.getContents(statusFilter);
            setContents(data);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const getStatusBadge = (s: string) => {
        switch (s) {
            case 'PENDING_REVIEW': return <Badge className="bg-orange-100 text-orange-700 hover:bg-orange-100 border-none">승인대기</Badge>;
            case 'PUBLISHED': return <Badge className="bg-green-100 text-green-700 hover:bg-green-100 border-none">발행됨</Badge>;
            case 'REJECTED': return <Badge className="bg-red-100 text-red-700 hover:bg-red-100 border-none">반려됨</Badge>;
            case 'DRAFT': return <Badge className="bg-gray-100 text-gray-700 hover:bg-gray-100 border-none">작성중</Badge>;
            default: return <Badge variant="outline">{s}</Badge>;
        }
    };

    const handleDeleteConfirm = async () => {
        if (!deleteTarget) return;
        setDeleting(true);
        try {
            await creatorService.deleteContent(deleteTarget.id);
            setContents(prev => prev.filter(c => c.id !== deleteTarget.id));
            setDeleteTarget(null);
        } catch (error) {
            console.error(error);
            alert('삭제 실패: ' + error);
        } finally {
            setDeleting(false);
        }
    };

    return (
        <div className="space-y-4 relative">
            <div className="flex justify-between items-center bg-gray-50 p-3 rounded-lg border">
                <span className="text-sm font-medium text-gray-700">심사 상태 필터</span>
                <div className="flex gap-2">
                    {(['PENDING_REVIEW', 'PUBLISHED', 'REJECTED'] as CreatorContentStatus[]).map(s => (
                        <Button
                            key={s}
                            variant={statusFilter === s ? 'default' : 'ghost'}
                            size="sm"
                            className={statusFilter === s ? 'bg-[#1C4526] hover:bg-[#15331d]' : ''}
                            onClick={() => setStatusFilter(s)}
                        >
                            {s === 'PENDING_REVIEW' && '대기중'}
                            {s === 'PUBLISHED' && '발행됨'}
                            {s === 'REJECTED' && '반려됨'}
                        </Button>
                    ))}
                </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
                <table className="w-full text-sm text-left">
                    <thead className="bg-[#F7F5EF] text-gray-600 font-medium border-b border-[#ECE8DF]">
                        <tr>
                            <th className="px-6 py-4 w-[40%]">제목 / 유형</th>
                            <th className="px-6 py-4">작가</th>
                            <th className="px-6 py-4">작성일</th>
                            <th className="px-6 py-4">상태</th>
                            <th className="px-6 py-4 text-right">관리</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {loading ? (
                            <tr>
                                <td colSpan={5} className="py-20 text-center text-gray-400">
                                    <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                                    로딩중...
                                </td>
                            </tr>
                        ) : contents.length === 0 ? (
                            <tr>
                                <td colSpan={5} className="py-20 text-center text-gray-400">
                                    해당 상태의 콘텐츠가 없습니다.
                                </td>
                            </tr>
                        ) : (
                            contents.map(item => (
                                <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                                    <td className="px-6 py-4">
                                        <div className="font-bold text-gray-900 line-clamp-1">{item.title}</div>
                                        <div className="text-xs text-gray-500 mt-1 flex items-center gap-2">
                                            <Badge variant="outline" className="text-[10px] px-1 py-0">{item.type}</Badge>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="text-gray-900 font-medium">{item.creators.bio || '익명'}</div>
                                    </td>
                                    <td className="px-6 py-4 text-gray-500 text-xs">
                                        {format(new Date(item.created_at), 'yyyy.MM.dd HH:mm')}
                                    </td>
                                    <td className="px-6 py-4">
                                        {getStatusBadge(item.status)}
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex gap-2 justify-end">
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={() => router.push(`/admin/content/${item.id}`)}
                                                className="border-gray-200 hover:bg-[#1C4526] hover:text-white transition-colors"
                                            >
                                                심사하기
                                            </Button>
                                            <Button
                                                size="sm"
                                                variant="destructive"
                                                onClick={() => setDeleteTarget(item)}
                                            >
                                                삭제
                                            </Button>
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* 삭제 확인 Dialog */}
            <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>콘텐츠 삭제</AlertDialogTitle>
                        <AlertDialogDescription>
                            정말 <span className="font-bold text-gray-900">{deleteTarget?.title}</span> 콘텐츠를 삭제하시겠습니까?
                            <br />
                            이 작업은 되돌릴 수 없습니다.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={deleting}>취소</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleDeleteConfirm}
                            disabled={deleting}
                            className="bg-red-500 hover:bg-red-600"
                        >
                            {deleting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                            삭제
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
