"use client";

import { useState } from "react";
import TopBar from "@/components/TopBar";
import HeroSection from "@/components/myspace/HeroSection";
import ActionButtons from "@/components/myspace/ActionButtons";
import EmotionalQuote from "@/components/myspace/EmotionalQuote";
import SummaryGrid from "@/components/myspace/SummaryGrid";
import MyTimeline from "@/components/myspace/MyTimeline";
import UpcomingReservation from "@/components/myspace/UpcomingReservation";
import SlimNotice from "@/components/myspace/SlimNotice";
import MyGroupsWidget from "@/components/myspace/MyGroupsWidget";
import PaperBackground from "@/components/myspace/PaperBackground";
import NotificationBadge from "@/components/common/NotificationBadge";
import QuickRecordForm from "@/components/myspace/QuickRecordForm";
import { Sparkles } from "lucide-react";
import { useFabSparkle } from "@/hooks/useFabSparkle";
import { cn } from "@/lib/utils";
import ReminderBanner from "@/components/myspace/ReminderBanner";

export default function MySpacePage() {
    const [isRecordOpen, setIsRecordOpen] = useState(false);
    const { shouldSparkle, unwrittenScheduleIds, unwrittenScheduleDetail, refresh } = useFabSparkle();

    const handleRecordClick = () => {
        setIsRecordOpen(true);
    };

    const handleRecordSuccess = () => {
        refresh(); // 반짝임 상태 갱신
        // 타임라인 새로고침 등 필요 시 처리
    };

    return (
        <PaperBackground className="w-full pb-32">
            {/* 1. Top Bar (Static) */}
            <TopBar />

            {/* 2. Hero Section (POV & Widgets) */}
            <HeroSection />

            {/* 미작성 일정 기록 독려 배너 */}
            <ReminderBanner
                detail={unwrittenScheduleDetail}
                onClick={handleRecordClick}
            />

            {/* 3. Action Buttons */}
            <ActionButtons />

            {/* 3.5 Emotional Quote - 동적 감성 문구 */}
            <EmotionalQuote />

            {/* 4. My Groups Widget */}
            <MyGroupsWidget />

            {/* 4. Summary Grid */}
            <SummaryGrid />

            {/* 5. My Timeline */}
            <MyTimeline />

            {/* 5.5 Notification Badge (Inline) */}
            <NotificationBadge variant="inline" />

            {/* 6. Slim Notice */}
            <SlimNotice />

            {/* 7. Upcoming Reservation Card */}
            <UpcomingReservation />

            {/* 1분 기록 FAB 버튼 */}
            <button
                onClick={handleRecordClick}
                className={cn(
                    "fixed bottom-24 right-4 z-40 w-14 h-14 rounded-full bg-[#224732] text-white shadow-lg flex items-center justify-center transition-all",
                    "hover:bg-[#1a3626] active:scale-95",
                    shouldSparkle && "animate-pulse ring-4 ring-[#224732]/30"
                )}
                title="1분 기록"
            >
                <Sparkles className={cn("w-6 h-6", shouldSparkle && "animate-spin-slow")} />
            </button>

            {/* 1분 기록 Sheet */}
            <QuickRecordForm
                isOpen={isRecordOpen}
                onClose={() => setIsRecordOpen(false)}
                scheduleId={unwrittenScheduleIds[0]} // 미작성 일정이 있으면 첫 번째 ID 전달
                onSuccess={handleRecordSuccess}
            />
        </PaperBackground>
    );
}
