"use client";

import TopBar from "@/components/TopBar";
import HeroSection from "@/components/myspace/HeroSection";
import ActionButtons from "@/components/myspace/ActionButtons";
import SummaryGrid from "@/components/myspace/SummaryGrid";
import MyTimeline from "@/components/myspace/MyTimeline";
import UpcomingReservation from "@/components/myspace/UpcomingReservation";
import SlimNotice from "@/components/myspace/SlimNotice";
import MyGroupsWidget from "@/components/myspace/MyGroupsWidget";

export default function MySpacePage() {
    return (
        <div className="w-full min-h-screen bg-surface-1 pb-32">
            {/* 1. Top Bar (Static) */}
            <TopBar />

            {/* 2. Hero Section (POV & Widgets) */}
            <HeroSection />

            {/* 3. Action Buttons */}
            <ActionButtons />

            {/* 3.5 My Groups Widget */}
            <MyGroupsWidget />

            {/* 4. Summary Grid */}
            <SummaryGrid />

            {/* 5. My Timeline */}
            <MyTimeline />

            {/* 6. Slim Notice */}
            <SlimNotice />

            {/* 7. Upcoming Reservation Card with Title */}
            <div className="mt-2">
                <h2 className="px-7 text-lg font-bold text-text-1 mb-3">다가오는 예약</h2>
                <UpcomingReservation />
            </div>
        </div>
    );
}
