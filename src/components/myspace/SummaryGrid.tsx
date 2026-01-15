"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Image as ImageIcon, History, Map, Award, Star } from "lucide-react";

import { useMySpaceStore } from "@/store/useMySpaceStore";
import { useReservationStore } from "@/store/useReservationStore";
import MyMapModal from './MyMapModal';

export default function SummaryGrid() {
    const router = useRouter();
    const { raonToken } = useMySpaceStore();
    const { reservations } = useReservationStore();

    // 모달 상태 관리
    const [isMapOpen, setIsMapOpen] = useState(false);

    // Calculate history (completed or confirmed reservations in the past)
    const historyCount = reservations.filter(r => r.status === 'COMPLETED' || (r.status === 'CONFIRMED' && new Date(r.checkOutDate) < new Date())).length;

    const items = [
        {
            icon: ImageIcon,
            label: "앨범",
            color: "text-blue-600",
            bg: "bg-blue-50",
            value: null,
            onClick: () => router.push('/myspace/album')
        },
        {
            icon: History,
            label: "내 히스토리",
            color: "text-purple-600",
            bg: "bg-purple-50",
            value: `${historyCount}회`,
            onClick: () => router.push('/myspace/history')
        },
        {
            icon: Star,
            label: "나의 탐험 지수",
            color: "text-[#1C4526]",
            bg: "bg-[#F5F2EB]",
            value: "XP & Token",
            onClick: () => router.push('/myspace/wallet')
        },
        {
            icon: Map,
            label: "나만의 캠핑지도",
            color: "text-emerald-600",
            bg: "bg-emerald-50",
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
                        className="group relative flex flex-col items-center justify-center p-5 pt-8 bg-white rounded-3xl shadow-soft border border-transparent hover:border-surface-2 hover:shadow-medium active:scale-95 transition-all duration-300 hover:rotate-0 hover:-translate-y-1"
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
                                className="w-14 h-5 rounded-sm opacity-60"
                                style={{
                                    background: 'linear-gradient(180deg, rgba(255,248,220,0.9) 0%, rgba(245,222,179,0.7) 100%)',
                                    boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
                                    border: '1px solid rgba(210,180,140,0.3)',
                                }}
                            />
                        </div>

                        <div className={`p-3.5 rounded-2xl ${item.bg} ${item.color} mb-3 transition-transform group-hover:scale-110 duration-300`}>
                            <item.icon size={22} strokeWidth={2} />
                        </div>
                        <span className="text-sm font-semibold text-text-2 group-hover:text-text-1 transition-colors">{item.label}</span>
                        {item.value && (
                            <span className="text-xs font-bold text-brand-1 mt-1">{item.value}</span>
                        )}
                    </button>
                ))}
            </div>

            {/* Modals */}
            <MyMapModal isOpen={isMapOpen} onClose={() => setIsMapOpen(false)} />
        </>
    );
}

