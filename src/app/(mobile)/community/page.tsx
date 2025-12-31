'use client';

import React from 'react';
import { useCommunityStore, BoardType } from '@/store/useCommunityStore';
import BottomNav from '@/components/BottomNav';
import CommunityHeader from '@/components/community/CommunityHeader';
import CommunityTabs from '@/components/community/CommunityTabs';
import CommunityBoardContainer from '@/components/community/CommunityBoardContainer';

import { useSearchParams, useRouter, usePathname } from 'next/navigation';

export default function CommunityPage() {
    const { activeTab, setActiveTab, loadPosts } = useCommunityStore();
    const searchParams = useSearchParams();
    const router = useRouter();
    const pathname = usePathname();
    const tabParam = searchParams.get('tab');
    const [isInitialized, setIsInitialized] = React.useState(false);

    // 1. Init from URL (Priority)
    React.useEffect(() => {
        if (tabParam) {
            setActiveTab(tabParam as BoardType);
        }
        setIsInitialized(true);
    }, [tabParam, setActiveTab]);

    // 2. Load Posts on Tab Change
    React.useEffect(() => {
        if (isInitialized) {
            loadPosts(activeTab);
        }
    }, [activeTab, loadPosts, isInitialized]);

    // 3. Handle Tab Selection (User Interaction)
    const handleTabChange = (newTab: BoardType) => {
        setActiveTab(newTab);
        // Explicitly update URL to persist state across reloads
        const params = new URLSearchParams(searchParams.toString());
        params.set('tab', newTab);
        router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    };

    // Prevent hydration mismatch or flash of default content
    if (!isInitialized && tabParam) {
        return <div className="min-h-screen bg-[#F7F5EF]" />; // Empty background while syncing
    }

    return (
        <div className="min-h-screen bg-[#F7F5EF] pb-24">
            {/* 1. Header & Hero */}
            <CommunityHeader />

            {/* 2. Tabs */}
            <div className="sticky top-[56px] z-40 bg-[#F7F5EF]/95 backdrop-blur-sm pt-2 pb-2">
                <CommunityTabs activeTab={activeTab} onTabChange={handleTabChange} />
            </div>

            {/* 3. Board Content */}
            <main className="px-5 mt-4">
                <CommunityBoardContainer activeTab={activeTab} />
            </main>

            <BottomNav />
        </div>
    );
}
