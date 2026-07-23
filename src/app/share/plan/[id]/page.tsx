'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getPublicSmartPlan, PublicSmartPlanData } from '@/actions/share';
import SmartPlanProposal from '@/components/plan/SmartPlanProposal';
import { Button } from '@/components/ui/button';
import { Loader2, AlertCircle, Sparkles, ChevronLeft } from 'lucide-react';
import Link from 'next/link';

export default function PublicSmartPlanPage() {
    const params = useParams();
    const router = useRouter();
    const scheduleId = params.id as string;

    const [planData, setPlanData] = useState<PublicSmartPlanData | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isError, setIsError] = useState(false);

    useEffect(() => {
        if (!scheduleId) {
            setIsLoading(false);
            setIsError(true);
            return;
        }

        const fetchPlan = async () => {
            setIsLoading(true);
            setIsError(false);
            try {
                const data = await getPublicSmartPlan(scheduleId);
                if (data && data.smart_plan_data) {
                    setPlanData(data);
                } else {
                    setIsError(true);
                }
            } catch (err) {
                console.error('[PublicSmartPlanPage] fetch error:', err);
                setIsError(true);
            } finally {
                setIsLoading(false);
            }
        };

        fetchPlan();
    }, [scheduleId]);

    // 1. Loading State (3-State Rule)
    if (isLoading) {
        return (
            <div className="min-h-screen bg-[#112318] text-white flex flex-col items-center justify-center p-6 space-y-4">
                <Loader2 className="w-10 h-10 text-[#4E8B65] animate-spin" />
                <p className="text-sm font-semibold text-emerald-200/80 animate-pulse">
                    공유된 스마트플랜을 불러오고 있습니다...
                </p>
            </div>
        );
    }

    // 2. Error State (3-State Rule)
    if (isError || !planData) {
        return (
            <div className="min-h-screen bg-[#112318] text-white flex flex-col items-center justify-center p-6 text-center">
                <div className="w-16 h-16 bg-red-500/10 border border-red-500/20 rounded-full flex items-center justify-center mb-4">
                    <AlertCircle className="w-8 h-8 text-red-400" />
                </div>
                <h1 className="text-xl font-bold text-white mb-2">스마트플랜을 찾을 수 없어요</h1>
                <p className="text-xs text-white/60 mb-6 max-w-xs leading-relaxed">
                    유효하지 않거나 만료된 공유 링크입니다. 라온아이에서 나만의 스마트플랜을 직접 만들어보세요!
                </p>
                <Button
                    onClick={() => router.push('/')}
                    className="bg-[#224732] hover:bg-[#2d5a40] text-white font-bold rounded-xl px-6 h-11 text-sm shadow-lg"
                >
                    라온아이 홈으로 이동
                </Button>
            </div>
        );
    }

    // 날짜 파싱 헬퍼
    const startDate = planData.check_in ? new Date(planData.check_in) : new Date();
    const endDate = planData.check_out ? new Date(planData.check_out) : new Date();
    const location = {
        lat: planData.campground_lat || 37.5665,
        lng: planData.campground_lng || 126.9780
    };

    // 3. Content State (3-State Rule)
    return (
        <div className="min-h-screen bg-[#0e1c13] text-white pb-36 font-sans">
            {/* Top Bar Header */}
            <header className="sticky top-0 z-40 bg-[#112318]/90 backdrop-blur-md border-b border-white/10 px-4 h-14 flex items-center justify-between shadow-md">
                <Link href="/" className="flex items-center gap-2 text-white/80 hover:text-white transition-colors">
                    <ChevronLeft className="w-5 h-5 text-emerald-400" />
                    <span className="text-sm font-bold tracking-tight text-white">라온아이 스마트플랜</span>
                </Link>
                <div className="flex items-center gap-1.5 bg-[#224732] px-3 py-1 rounded-full text-[11px] font-bold text-emerald-200 border border-emerald-500/30 shadow-inner">
                    <Sparkles className="w-3.5 h-3.5 text-amber-300 animate-pulse" />
                    공유된 여정
                </div>
            </header>

            {/* Main Content Area (Matches App Original Layout 100%) */}
            <main className="max-w-md mx-auto px-4 pt-6 space-y-6">
                {/* Premium CampWarm Hero Banner */}
                <div className="relative overflow-hidden bg-gradient-to-br from-[#1C4526] via-[#224732] to-[#0f2117] border border-emerald-500/30 rounded-3xl p-6 shadow-2xl">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-400/10 rounded-full blur-2xl pointer-events-none" />
                    <div className="relative z-10 flex flex-col items-center text-center space-y-3">
                        <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-white/10 rounded-full text-xs font-bold text-emerald-200 backdrop-blur-sm border border-white/10">
                            <span>🏕️ {planData.campground_name}</span>
                        </div>
                        <h1 className="text-xl font-black text-white tracking-tight leading-snug">
                            행복하고 편안한<br />스마트플랜 여정입니다
                        </h1>
                        <div className="flex items-center justify-center gap-2 text-xs font-medium text-emerald-200/90 pt-1">
                            <span className="bg-black/30 px-3 py-1 rounded-xl border border-white/10">
                                📅 {planData.check_in} ~ {planData.check_out}
                            </span>
                        </div>
                    </div>
                </div>

                {/* SmartPlan Proposal Cards with exact mobile margin */}
                <div className="w-full">
                    <SmartPlanProposal
                        scheduleId={planData.id}
                        initialPlan={planData.smart_plan_data}
                        location={location}
                        startDate={startDate}
                        endDate={endDate}
                        isPublicView={true}
                    />
                </div>
            </main>

            {/* Bottom CTA Fixed Bar for Viral Sign-up */}
            <div className="fixed bottom-0 left-0 right-0 z-50 p-4 bg-gradient-to-t from-[#0a160f] via-[#112318]/95 to-transparent backdrop-blur-md border-t border-white/10 shadow-2xl">
                <div className="max-w-md mx-auto flex items-center justify-between gap-3 px-1">
                    <div className="flex flex-col min-w-0">
                        <p className="text-xs font-black text-white truncate">나만의 맞춤 스마트플랜이 필요하신가요?</p>
                        <p className="text-[10px] text-emerald-300/80 truncate">라온아이에서 1초 만에 나만의 여행 일정을 받아보세요</p>
                    </div>
                    <Button
                        onClick={() => router.push('/')}
                        className="bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs px-4 h-11 rounded-xl shadow-lg shrink-0 border border-emerald-400/40 active:scale-95 transition-transform"
                    >
                        시작하기
                    </Button>
                </div>
            </div>
        </div>
    );
}
