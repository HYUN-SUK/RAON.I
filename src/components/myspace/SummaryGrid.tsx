"use client";

import { useState, useEffect } from 'react';

import { useRouter } from 'next/navigation';
import { Image as ImageIcon, History, Map, Star, Heart, CheckCircle2 } from "lucide-react";

import { useMySpaceStore } from "@/store/useMySpaceStore";
import { useReservationStore } from "@/store/useReservationStore";
import { createClient } from '@/lib/supabase-client';
import MyMapModal from './MyMapModal';
import MyContributionsModal from './MyContributionsModal';

interface SummaryGridProps {
    isLoading?: boolean;
}

export default function SummaryGrid({ isLoading = false }: SummaryGridProps) {
    const router = useRouter();
    const { timelineItems, isMapOpen, setIsMapOpen } = useMySpaceStore();
    const { reservations } = useReservationStore();
    const [contributionCount, setContributionCount] = useState<number>(0);
    const [isContributionOpen, setIsContributionOpen] = useState<boolean>(false);

    useEffect(() => {
        const fetchContributions = async () => {
            try {
                const supabase = createClient();
                const { data: { user } } = await supabase.auth.getUser();
                if (!user) return;

                const { count } = await supabase
                    .from('place_verifications')
                    .select('*', { count: 'exact', head: true })
                    .eq('user_id', user.id);

                setContributionCount(count || 0);
            } catch (e) {
                console.warn('fetchContributions error:', e);
            }
        };
        fetchContributions();
    }, []);

    if (isLoading) {
        return (
            <div className="grid grid-cols-2 gap-4 px-6 pb-8 animate-pulse">
                {[1, 2, 3, 4].map((idx) => (
                    <div key={idx} className="flex flex-col items-center justify-center p-5 pt-8 bg-stone-200/30 dark:bg-stone-800/30 rounded-3xl h-[120px]" />
                ))}
            </div>
        );
    }

    // Calculate history (completed or confirmed reservations in the past + 1분 기록)
    const reservationCount = reservations.filter(r => r.status === 'COMPLETED' || (r.status === 'CONFIRMED' && new Date(r.checkOutDate) < new Date())).length;
    const recordCount = timelineItems.filter(i => ['record', 'mission', 'photo'].includes(i.type)).length;
    const historyCount = reservationCount + recordCount;

    const items = [
        {
            icon: ImageIcon,
            label: "내 앨범",
            color: "text-[#C28238]",
            bg: "bg-[#FDF3E5]",
            value: null,
            onClick: () => router.push('/myspace/album')
        },
        {
            icon: History,
            label: "내 히스토리",
            color: "text-[#3D7A52]",
            bg: "bg-[#E1EFE4]",
            value: `${historyCount}회`,
            onClick: () => router.push('/myspace/history')
        },
        {
            icon: Star,
            label: "나의 탐험 지수",
            color: "text-[#3D7A52]",
            bg: "bg-[#E1EFE4]",
            value: contributionCount > 0 ? `✓ 확인 ${contributionCount}곳` : "XP & Token",
            onClick: () => router.push('/myspace/wallet')
        },
        {
            icon: Map,
            label: "나만의 캠핑지도",
            color: "text-[#C28238]",
            bg: "bg-[#FDF3E5]",
            value: null,
            onClick: () => setIsMapOpen(true)
        },
    ];


    // 카드별 기울기 + 테이프 위치/각도
    const cardStyles = [
        { rotate: '-0.8deg', tapeRotate: '-8deg', tapeOffset: '15%' },
        { rotate: '0.5deg', tapeRotate: '5deg', tapeOffset: '20%' },
        { rotate: '-0.5deg', tapeRotate: '-3deg', tapeOffset: '25%' },
        { rotate: '1deg', tapeRotate: '7deg', tapeOffset: '10%' },
    ];

    return (
        <>
            <div className="grid grid-cols-2 gap-4 px-6 pb-8">
                {items.map((item, index) => (
                    <button
                        key={item.label}
                        onClick={item.onClick}
                        style={{ transform: `rotate(${cardStyles[index].rotate})` }}
                        className="group relative flex flex-col items-center justify-center p-5 pt-8 bg-white rounded-3xl shadow-xs border border-[#EAEFEA] hover:border-[#68A678] hover:shadow-md active:scale-95 transition-all duration-300 hover:rotate-0 hover:-translate-y-0.5"
                    >
                        {/* 테이프 효과 - 상단 중앙 */}
                        <div
                            className="absolute -top-1 pointer-events-none"
                            style={{
                                left: cardStyles[index].tapeOffset,
                                transform: `rotate(${cardStyles[index].tapeRotate})`,
                            }}
                        >
                            <div
                                className="w-14 h-5 rounded-xs opacity-75"
                                style={{
                                    background: 'linear-gradient(180deg, rgba(247,235,212,0.95) 0%, rgba(238,217,185,0.8) 100%)',
                                    boxShadow: '0 1px 2px rgba(0,0,0,0.06)',
                                    border: '1px solid rgba(210,180,140,0.3)',
                                }}
                            />
                        </div>

                        <div className={`p-3.5 rounded-2xl ${item.bg} ${item.color} mb-2.5 transition-transform group-hover:scale-105 duration-200`}>
                            <item.icon size={22} strokeWidth={2.2} />
                        </div>
                        <span className="text-sm font-bold text-[#1E4D2B] transition-colors">{item.label}</span>
                        {item.value && (
                            <span className="text-xs font-black text-[#2E7D47] mt-1">{item.value}</span>
                        )}
                    </button>
                ))}
            </div>

            {/* Modals */}
            <MyMapModal isOpen={isMapOpen} onClose={() => setIsMapOpen(false)} />
            <MyContributionsModal isOpen={isContributionOpen} onClose={() => setIsContributionOpen(false)} />
        </>
    );
}


