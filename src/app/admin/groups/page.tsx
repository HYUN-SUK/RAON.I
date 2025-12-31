'use client';

import React, { useEffect, useState } from 'react';
import { fetchGroupsAdminAction, deleteGroupAdminAction } from '@/actions/admin-group';
import { Loader2, Trash2, Users } from 'lucide-react';
import Image from 'next/image';

interface Group {
    id: string;
    name: string;
    description: string;
    image_url: string;
    max_members: number;
    created_at: string;
    group_members: { count: number }[];
}

export default function AdminGroupsPage() {
    const [groups, setGroups] = useState<Group[]>([]);
    const [loading, setLoading] = useState(true);
    const [deletingId, setDeletingId] = useState<string | null>(null);

    const loadGroups = async () => {
        try {
            const data = await fetchGroupsAdminAction();
            setGroups(data || []);
        } catch (error) {
            console.error(error);
            alert('소모임 목록을 불러오지 못했습니다.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadGroups();
    }, []);

    const handleDelete = async (id: string) => {
        if (!confirm('정말 이 소모임을 삭제하시겠습니까?')) return;

        setDeletingId(id);
        try {
            await deleteGroupAdminAction(id);
            setGroups(prev => prev.filter(g => g.id !== id));
        } catch (error) {
            console.error(error);
            alert('삭제 실패');
        } finally {
            setDeletingId(null);
        }
    };

    if (loading) return <div className="p-8"><Loader2 className="animate-spin" /></div>;

    return (
        <div className="space-y-6">
            <h1 className="text-2xl font-bold text-gray-800">소모임 관리</h1>

            <div className="bg-white rounded-lg shadow overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">이미지</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">이름 / 설명</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">멤버</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">생성일</th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">관리</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {groups.map((group) => (
                            <tr key={group.id} className="hover:bg-gray-50">
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <div className="h-10 w-10 relative rounded overflow-hidden bg-gray-200">
                                        {group.image_url && <Image src={group.image_url} alt="" fill className="object-cover" sizes="40px" />}
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    <div className="text-sm font-medium text-gray-900">{group.name}</div>
                                    <div className="text-sm text-gray-500 line-clamp-1">{group.description}</div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                    <div className="flex items-center gap-1">
                                        <Users size={14} />
                                        {group.group_members?.[0]?.count || 0} / {group.max_members}
                                    </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                    {new Date(group.created_at).toLocaleDateString()}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                    <button
                                        onClick={() => handleDelete(group.id)}
                                        disabled={deletingId === group.id}
                                        className="text-red-600 hover:text-red-900 disabled:opacity-50"
                                    >
                                        {deletingId === group.id ? <Loader2 className="animate-spin w-5 h-5" /> : <Trash2 className="w-5 h-5" />}
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {groups.length === 0 && (
                    <div className="p-8 text-center text-gray-500">생성된 소모임이 없습니다.</div>
                )}
            </div>
        </div>
    );
}
