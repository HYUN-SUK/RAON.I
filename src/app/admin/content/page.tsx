"use client";

import React, { useEffect, useState } from 'react';
import { creatorService } from '@/services/creatorService';
import { CreatorContent, Creator, CreatorContentStatus } from '@/types/creator';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';

export default function AdminContentListPage() {
    const router = useRouter();
    const [contents, setContents] = useState<(CreatorContent & { creators: Creator })[]>([]);
    const [loading, setLoading] = useState(true);
    const [statusFilter, setStatusFilter] = useState<CreatorContentStatus>('PENDING_REVIEW');

    const fetchContents = React.useCallback(async () => {
        try {
            setLoading(true);
            const data = await creatorService.getContents(statusFilter);
            setContents(data);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    }, [statusFilter]);

    useEffect(() => {
        fetchContents();
    }, [fetchContents]);

    const getStatusBadge = (s: string) => {
        switch (s) {
            case 'PENDING_REVIEW': return <Badge className="bg-orange-100 text-orange-700 hover:bg-orange-100">승인대기</Badge>;
            case 'PUBLISHED': return <Badge className="bg-green-100 text-green-700 hover:bg-green-100">발행됨</Badge>;
            case 'REJECTED': return <Badge className="bg-red-100 text-red-700 hover:bg-red-100">반려됨</Badge>;
            case 'DRAFT': return <Badge className="bg-gray-100 text-gray-700 hover:bg-gray-100">작성중</Badge>;
            default: return <Badge variant="outline">{s}</Badge>;
        }
    };

    return (
        <div className="p-6 max-w-7xl mx-auto">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold text-gray-800">콘텐츠 승인 관리</h1>
                <div className="flex gap-2">
                    {(['PENDING_REVIEW', 'PUBLISHED', 'REJECTED'] as CreatorContentStatus[]).map(s => (
                        <Button
                            key={s}
                            variant={statusFilter === s ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => setStatusFilter(s)}
                        >
                            {s === 'PENDING_REVIEW' && '대기중'}
                            {s === 'PUBLISHED' && '발행됨'}
                            {s === 'REJECTED' && '반려됨'}
                        </Button>
                    ))}
                </div>
            </div>

            <div className="bg-white rounded-xl shadow border overflow-hidden">
                <table className="w-full text-sm text-left">
                    <thead className="bg-gray-50 text-gray-600 font-medium border-b">
                        <tr>
                            <th className="px-6 py-4">제목 / 유형</th>
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
                                        <div className="font-medium text-gray-900">{item.title}</div>
                                        <div className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                                            <span className="font-semibold text-[#1C4526]">{item.type}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="text-gray-900">{item.creators.bio || 'Unknown'}</div>
                                        <div className="text-xs text-gray-400">{item.creators.region || '-'}</div>
                                    </td>
                                    <td className="px-6 py-4 text-gray-500">
                                        {format(new Date(item.created_at), 'yyyy-MM-dd HH:mm')}
                                    </td>
                                    <td className="px-6 py-4">
                                        {getStatusBadge(item.status)}
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex gap-2 justify-end">
                                            <Button
                                                size="sm"
                                                onClick={() => router.push(`/admin/content/${item.id}`)}
                                                className="bg-[#1C4526]"
                                            >
                                                심사하기
                                            </Button>
                                            <Button
                                                size="sm"
                                                variant="destructive"
                                                onClick={async () => {
                                                    if (confirm('정말 이 콘텐츠를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.')) {
                                                        try {
                                                            await creatorService.deleteContent(item.id);
                                                            fetchContents();
                                                        } catch (error) {
                                                            alert('삭제 실패: ' + error);
                                                        }
                                                    }
                                                }}
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
        </div>
    );
}
