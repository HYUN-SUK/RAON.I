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
        <div className="w-full max-w-[430px] min-h-screen relative shadow-2xl flex flex-col mx-auto overflow-x-hidden bg-[#F7F5EF] font-sans">
            {/* Top Bar Header (Matches App Original 100%) */}
            <header className="sticky top-0 z-40 bg-[#F7F5EF]/95 backdrop-blur-md border-b border-stone-200/80 px-4 h-14 flex items-center justify-between shadow-xs">
                <Link href="/" className="flex items-center gap-2 text-stone-700 hover:text-stone-900 transition-colors">
                    <ChevronLeft className="w-5 h-5 text-[#224732]" />
                </Link>
                <span className="text-base font-black tracking-tight text-[#224732] truncate max-w-[220px]">
                    {planData.campground_name || '스마트플랜'}
                </span>
                <div className="flex items-center gap-1 bg-[#224732]/10 px-2.5 py-1 rounded-full text-[11px] font-bold text-[#224732] border border-[#224732]/20">
                    <Sparkles className="w-3 h-3 text-amber-500" />
                    공유된 여정
                </div>
            </header>

            {/* Main Content Area (Matches App Original Layout & Margins 100%) */}
            <main className="flex-1 p-4 space-y-4 pb-36">
                <SmartPlanProposal
                    scheduleId={planData.id}
                    initialPlan={planData.smart_plan_data}
                    location={location}
                    startDate={startDate}
                    endDate={endDate}
                    isPublicView={true}
                />
            </main>

            {/* Bottom CTA Fixed Bar for Viral Sign-up */}
            <div className="fixed bottom-0 left-0 right-0 z-50 p-4 bg-[#F7F5EF]/95 backdrop-blur-md border-t border-stone-200/80 shadow-2xl">
                <div className="max-w-[430px] mx-auto flex items-center justify-between gap-3 px-1">
                    <div className="flex flex-col min-w-0">
                        <p className="text-xs font-bold text-stone-900 truncate">나만의 맞춤 스마트플랜이 필요하신가요?</p>
                        <p className="text-[10px] text-[#224732]/80 font-medium truncate">라온아이에서 1초 만에 나만의 여행 일정을 받아보세요</p>
                    </div>
                    <Button
                        onClick={() => router.push('/')}
                        className="bg-[#224732] hover:bg-[#1a3626] text-white font-extrabold text-xs px-4 h-11 rounded-xl shadow-md shrink-0 active:scale-95 transition-transform"
                    >
                        시작하기
                    </Button>
                </div>
            </div>
        </div>
    );
}
