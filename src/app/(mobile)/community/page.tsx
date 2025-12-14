'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import BottomNav from '@/components/BottomNav';
import CommunityHeader from '@/components/community/CommunityHeader';
import CommunityTabs from '@/components/community/CommunityTabs';
import CommunityBoardContainer from '@/components/community/CommunityBoardContainer';
import { useCommunityStore } from '@/store/useCommunityStore';

export default function CommunityPage() {
    const { activeTab, setActiveTab } = useCommunityStore();

    return (
        <div className="min-h-screen bg-[#F7F5EF] pb-24">
            {/* 1. Header & Hero */}
            <CommunityHeader />

            {/* 2. Tabs */}
            <div className="sticky top-[56px] z-40 bg-[#F7F5EF]/95 backdrop-blur-sm pt-2 pb-2">
                <CommunityTabs activeTab={activeTab} onTabChange={setActiveTab} />
            </div>

            {/* 3. Board Content */}
            <main className="px-5 mt-4">
                <CommunityBoardContainer activeTab={activeTab} />
            </main>

            <BottomNav />
        </div>
    );
}
