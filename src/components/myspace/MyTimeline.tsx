"use client";

import React from 'react';
import { useMySpaceStore } from '@/store/useMySpaceStore';
import TimelineCard from './TimelineCard';
import { Calendar, Loader2 } from 'lucide-react';

interface MyTimelineProps {
    isLoading?: boolean;
}

export default function MyTimeline({ isLoading = false }: MyTimelineProps) {
    const { timelineItems, isTimelineLoading, isTimelineLoaded } = useMySpaceStore();
    
    // 1) 상위 페이지 로딩 중이거나
    // 2) 타임라인 비동기 조회가 진행 중이거나
    // 3) 아직 첫 회 조회가 완료되지 않은 상태(!isTimelineLoaded)인 경우
    // => 무조건 로딩 안내 화면을 노출하여 '아직 기록된 활동이 없어요'가 깜빡이는 현상 원천 차단
    const effectiveLoading = isLoading || isTimelineLoading || (!isTimelineLoaded && timelineItems.length === 0);

    if (effectiveLoading) {
        return (
            <section className="px-6 pb-20">
                <div className="flex justify-between items-center mb-5">
                    <h3 className="text-lg font-black text-[#1E4D2B] flex items-center gap-2">
                        <Calendar className="w-5 h-5 text-[#2E7D47]" />
                        나의 캠핑 로그
                    </h3>
                </div>
                {/* ⛺ 로딩 안내 문구 & 스켈레톤 */}
                <div className="bg-[#E2EFE5] border border-[#B3C9B8] rounded-2xl p-4 mb-4 flex items-center gap-3 shadow-2xs">
                    <Loader2 className="w-5 h-5 text-[#2E7D47] animate-spin shrink-0" />
                    <p className="text-xs sm:text-sm font-bold text-[#1E4D2B]">
                        ⛺ 나의 소중한 캠핑 기록을 불러오는 중입니다...
                    </p>
                </div>
                <div className="space-y-3.5 animate-pulse">
                    {[1, 2].map((idx) => (
                        <div key={idx} className="w-full h-[96px] bg-white border border-[#EAEFEA] rounded-2xl shadow-xs" />
                    ))}
                </div>
            </section>
        );
    }

    return (
        <section className="px-6 pb-20">
            <div className="flex justify-between items-center mb-5">
                <h3 className="text-lg font-black text-[#1E4D2B] flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-[#2E7D47]" />
                    나의 캠핑 로그
                </h3>
            </div>

            {/* AI 개인화 분석은 추후 구현 예정 */}

            <div className="flex flex-col">
                {timelineItems.length > 0 ? (
                    <>
                        {timelineItems.slice(0, 3).map((item) => (
                            <TimelineCard key={item.id} item={item} />
                        ))}
                        <p className="text-center py-4 text-stone-400 text-sm">"이곳에는 당신의 캠핑 이야기가 차곡차곡 쌓이게 됩니다."</p>
                    </>
                ) : (
                    <div className="text-center py-10 text-stone-400">
                        <p>아직 기록된 활동이 없어요.</p>
                    </div>
                )}
            </div>
        </section>
    );
}
