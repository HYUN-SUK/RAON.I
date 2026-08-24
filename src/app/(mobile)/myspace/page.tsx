"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
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
import MyMapModal from "@/components/myspace/MyMapModal";
import { PenLine } from "lucide-react";
import { useFabSparkle } from "@/hooks/useFabSparkle";
import { cn } from "@/lib/utils";
import ReminderBanner from "@/components/myspace/ReminderBanner";
import { createClient } from "@/lib/supabase-client";
import { useMySpaceStore } from "@/store/useMySpaceStore";

import { useReservationStore } from "@/store/useReservationStore";
import { useMissionStore } from "@/store/useMissionStore";

interface EmberStats {
    received_count: number;
    sent_count: number;
}

export default function MySpacePage() {
    const router = useRouter();
    const [isRecordOpen, setIsRecordOpen] = useState(false);
    const { shouldSparkle, unwrittenScheduleIds, unwrittenScheduleDetail, refresh } = useFabSparkle();

    // Global loading & state (캐시가 있으면 0.01초 즉시 렌더링)
    const [pageLoading, setPageLoading] = useState(() => {
        const storeReservations = useReservationStore.getState().reservations;
        return !(storeReservations && storeReservations.length > 0);
    });
    const [familyType, setFamilyType] = useState<string | undefined>(undefined);
    const [emberStats, setEmberStats] = useState<EmberStats | null>(null);

    const loadAllData = useCallback(async () => {
        const supabase = createClient();
        
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                router.push('/login');
                return;
            }

            // [v11.9.106 - 1단계: 즉시 로드 0.2초] 프로필, 예약, 미션 먼저 렌더링
            const [_prof, _res, _mis, _sp, profileRes] = await Promise.all([
                useMySpaceStore.getState().fetchProfile(user.id),
                useReservationStore.getState().fetchMyReservations(),
                useMissionStore.getState().fetchCurrentMission(),
                refresh(),
                supabase.from('profiles').select('family_type').eq('id', user.id).maybeSingle()
            ]);

            if (profileRes?.data?.family_type) {
                setFamilyType(profileRes.data.family_type);
            }

            // 0.2초 만에 사용자 화면 1차 완성
            setPageLoading(false);

            // [v11.9.106 - 2단계: 지연 백그라운드 로드] 중량 데이터(타임라인, 엠버 통계) 비동기 연결
            Promise.all([
                useMySpaceStore.getState().fetchTimeline(user.id),
                supabase.rpc('get_my_ember_stats')
            ]).then(([_tl, emberRes]) => {
                if (emberRes?.data && emberRes.data.success) {
                    setEmberStats({
                        received_count: emberRes.data.received_count,
                        sent_count: emberRes.data.sent_count
                    });
                }
            }).catch(e => console.warn('[MySpace] Background data fetch warning:', e));

        } catch (error) {
            console.error("Failed to fetch MySpace data:", error);
            setPageLoading(false);
        }
    }, [router, refresh]);

    // [v14.1.4] 다른 탭에서 내 수첩으로 첫 진입할 때만 딱 1회 이전 세션 잔재 초기화 (새로고침 시에는 지도 유지)
    useEffect(() => {
        useMySpaceStore.getState().setIsMapOpen(false);
    }, []);

    useEffect(() => {
        loadAllData();
    }, [loadAllData]);


    const handleRecordClick = () => {
        setIsRecordOpen(true);
    };

    const handleRecordSuccess = () => {
        loadAllData(); // 전체 데이터 및 반짝임 리로드
    };

    return (
        <PaperBackground className="w-full pb-32">
            {/* 1. Top Bar (Static) */}
            <TopBar />

            {/* 2. Hero Section (POV & Widgets) */}
            <HeroSection isLoading={pageLoading} emberStats={emberStats} />

            {/* 미작성 일정 기록 독려 배너 */}
            <ReminderBanner
                detail={unwrittenScheduleDetail}
                onClick={handleRecordClick}
            />

            {/* 3. Action Buttons */}
            <ActionButtons />

            {/* 3.5 Emotional Quote - 동적 감성 문구 */}
            <EmotionalQuote familyType={familyType} />

            {/* 4. My Groups Widget */}
            <MyGroupsWidget isLoading={pageLoading} />

            {/* 4. Summary Grid */}
            <SummaryGrid isLoading={pageLoading} />

            {/* 5. My Timeline */}
            <MyTimeline isLoading={pageLoading} />

            {/* 5.5 Notification Badge (Inline) */}
            <NotificationBadge variant="inline" />

            {/* 6. Slim Notice */}
            <SlimNotice />

            {/* 7. Upcoming Reservation Card */}
            <UpcomingReservation isLoading={pageLoading} onRefresh={loadAllData} />

            {/* 10초 기록 FAB 버튼 (구 1분 기록) */}
            <button
                onClick={handleRecordClick}
                className={cn(
                    "fixed bottom-24 right-4 z-40 h-12 px-4 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-lg flex items-center gap-1.5 transition-all",
                    "hover:from-amber-600 hover:to-orange-600 active:scale-95",
                    shouldSparkle && "animate-pulse ring-4 ring-orange-500/30"
                )}
                title="10초 기록"
            >
                <PenLine className="w-4 h-4" />
                <span className="text-xs font-black tracking-tight">10초 기록</span>
            </button>

            {/* 1분 기록 Sheet */}
            <QuickRecordForm
                isOpen={isRecordOpen}
                onClose={() => setIsRecordOpen(false)}
                scheduleId={unwrittenScheduleIds[0]} // 미작성 일정이 있으면 첫 번째 ID 전달
                onSuccess={handleRecordSuccess}
            />

            {/* 나만의 캠핑 지도 모달 바인딩 */}
            <MyMapModal
                isOpen={useMySpaceStore(state => state.isMapOpen)}
                onClose={() => useMySpaceStore.getState().setIsMapOpen(false)}
            />
        </PaperBackground>
    );
}

