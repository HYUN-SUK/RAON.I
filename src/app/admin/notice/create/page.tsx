'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { useCommunityStore } from '@/store/useCommunityStore';
import AdminNoticeForm from '@/components/admin/AdminNoticeForm';

export default function AdminNoticeCreatePage() {
    const router = useRouter();
    const { createPost, isLoading } = useCommunityStore();

    const handleCreate = async (data: { title: string; content: string; images: string[]; status: 'OPEN' | 'CLOSED' }) => {
        await createPost({
            type: 'NOTICE',
            title: data.title,
            content: data.content,
            author: '관리자',
            images: data.images,
            status: data.status,
            visibility: data.status === 'CLOSED' ? 'PRIVATE' : 'PUBLIC',
        });
        router.push('/admin/notice');
    };

    return (
        <AdminNoticeForm
            mode="CREATE"
            onSubmit={handleCreate}
            isLoading={isLoading}
        />
    );
}
