"use client";

import React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AdminContentListTab } from '@/components/admin/community/AdminContentListTab';
import { ShieldAlert, BookOpen } from 'lucide-react';

export default function AdminCommunityPage() {
    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold text-gray-800">커뮤니티 관리</h2>
            </div>

            <Tabs defaultValue="content" className="w-full">
                <TabsList className="grid w-full grid-cols-2 lg:w-[400px]">
                    <TabsTrigger value="general">
                        <ShieldAlert className="w-4 h-4 mr-2" /> 일반 게시글 (신고)
                    </TabsTrigger>
                    <TabsTrigger value="content">
                        <BookOpen className="w-4 h-4 mr-2" /> 콘텐츠 승인 (CP)
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="general" className="mt-6">
                    <div className="bg-white p-12 text-center text-gray-400 rounded-xl border border-dashed">
                        일반 커뮤니티 게시글 및 신고 접수 관리 기능 준비 중입니다.
                    </div>
                </TabsContent>

                <TabsContent value="content" className="mt-6">
                    <AdminContentListTab />
                </TabsContent>
            </Tabs>
        </div>
    );
}
