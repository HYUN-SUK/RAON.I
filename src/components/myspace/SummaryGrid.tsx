"use client";

import { useState } from 'react';
import { Image as ImageIcon, History, Map, Award } from "lucide-react";

import { useMySpaceStore } from "@/store/useMySpaceStore";
import { useReservationStore } from "@/store/useReservationStore";
import AlbumModal from './AlbumModal';
import MyMapModal from './MyMapModal';

export default function SummaryGrid() {
    const { points } = useMySpaceStore();
    const { reservations } = useReservationStore();

    // 모달 상태 관리
    const [isAlbumOpen, setIsAlbumOpen] = useState(false);
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
            onClick: () => setIsAlbumOpen(true)
        },
        {
            icon: History,
            label: "히스토리",
            color: "text-purple-600",
            bg: "bg-purple-50",
            value: `${historyCount}회`,
            onClick: () => alert(`총 ${historyCount}회의 캠핑 기록이 있습니다.`) // 히스토리는 아직 별도 모달 없음
        },
        {
            icon: Award,
            label: "포인트",
            color: "text-amber-600",
            bg: "bg-amber-50",
            value: `${points.toLocaleString()} P`,
            onClick: () => alert(`현재 보유 포인트: ${points.toLocaleString()} P`)
        },
        {
            icon: Map,
            label: "나만의 지도",
            color: "text-emerald-600",
            bg: "bg-emerald-50",
            value: null,
            onClick: () => setIsMapOpen(true)
        },
    ];

    return (
        <>
            <div className="grid grid-cols-2 gap-4 px-6 pb-8">
                {items.map((item) => (
                    <button
                        key={item.label}
                        onClick={item.onClick}
                        className="group flex flex-col items-center justify-center p-5 bg-white rounded-3xl shadow-soft border border-transparent hover:border-surface-2 hover:shadow-medium active:scale-95 transition-all duration-300 transform hover:-translate-y-1"
                    >
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
            <AlbumModal isOpen={isAlbumOpen} onClose={() => setIsAlbumOpen(false)} />
            <MyMapModal isOpen={isMapOpen} onClose={() => setIsMapOpen(false)} />
        </>
    );
}
