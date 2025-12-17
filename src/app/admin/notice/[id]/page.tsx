'use client';

import React, { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useCommunityStore, Post } from '@/store/useCommunityStore';
import { communityService } from '@/services/communityService';
import AdminNoticeForm from '@/components/admin/AdminNoticeForm';
import { Loader2 } from 'lucide-react';

export default function AdminNoticeDetailPage() {
    const router = useRouter();
    const params = useParams();
    const id = params.id as string;

    const { updatePost, isLoading } = useCommunityStore();
    const [post, setPost] = useState<Post | null>(null);
    const [fetchLoading, setFetchLoading] = useState(true);

    useEffect(() => {
        if (id) {
            loadNoticeData();
        }
    }, [id]);

    const loadNoticeData = async () => {
        try {
            setFetchLoading(true);
            const data = await communityService.getPostById(id);
            setPost(data);
        } catch (error) {
            console.error('Failed to load post', error);
            alert('공지사항을 불러오지 못했습니다.');
            router.back();
        } finally {
            setFetchLoading(false);
        }
    };

    const handleUpdate = async (data: { title: string; content: string; images: string[]; status: 'OPEN' | 'CLOSED' }) => {
        await updatePost(id, {
            title: data.title,
            content: data.content,
            images: data.images,
            status: data.status,
            visibility: data.status === 'CLOSED' ? 'PRIVATE' : 'PUBLIC',
        });
        alert('공지가 수정되었습니다.');
        router.push('/admin/notice');
    };

    if (fetchLoading) {
        return <div className="p-8 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-gray-400" /></div>;
    }

    return (
        <AdminNoticeForm
            mode="EDIT"
            initialData={post || undefined}
            onSubmit={handleUpdate}
            isLoading={isLoading}
        />
    );
}
