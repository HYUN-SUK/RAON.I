'use client';

import React from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Plus, Search } from 'lucide-react';

import { useCommunityStore } from '@/store/useCommunityStore';

export default function CommunityHeader() {
    const { activeTab, currentUser, searchQuery, setSearchQuery } = useCommunityStore();

    // Permissions: Only Admin can write in NOTICE
    const canWrite = activeTab !== 'NOTICE' || currentUser.role === 'ADMIN';

    return (
        <header className="pt-6 pb-2 px-5 bg-[#F7F5EF] space-y-4">
            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="flex justify-between items-center"
            >
                <div>
                    <h1 className="text-2xl font-bold text-[#1C4526] mb-1">
                        캠퍼들의 이야기
                    </h1>
                    <p className="text-sm text-[#4D4D4D] font-light">
                        함께 나누는 따뜻한 캠핑의 기억 ⛺
                    </p>
                </div>

                <Link href="/community/write">
                    <Button
                        size="sm"
                        className="bg-[#1C4526] hover:bg-[#1C4526]/90 text-white rounded-full shadow-md px-4"
                    >
                        <Plus className="w-4 h-4 mr-1" />
                        <span className="font-medium">글쓰기</span>
                    </Button>
                </Link>
            </motion.div>

            {/* Search Bar */}
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                    type="text"
                    placeholder="검색어를 입력하세요 (제목, 내용)"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full h-10 pl-10 pr-4 rounded-xl bg-white border border-gray-200 focus:outline-none focus:border-[#1C4526] text-sm transition-all shadow-sm placeholder:text-gray-400"
                />
            </div>
        </header>
    );
}
