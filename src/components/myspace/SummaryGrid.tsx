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
            icon: Star, // Changed Icon to Star (XP)
            label: "나의 탐험 지수", // Changed Label
            color: "text-[#1C4526]", // Changed Color
            bg: "bg-[#F5F2EB]", // Changed BG
            value: "XP & Token", // Placeholder, or fetch real value if possible? SummaryGrid doesn't have wallet data yet.
            // For MVP, just show title or maybe inject data? 
            // The original code used `useMySpaceStore`. I'll stick to store data but label it differently.
            // Wait, useMySpaceStore has `points`. I should probably show "Lv.1" or something if I can, but `points` is all I have here.
            // Let's keep it simple for now as requested: "XP & TOKEN" style.
            onClick: () => router.push('/myspace/wallet') // Redirect to wallet page for history
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
            <MyMapModal isOpen={isMapOpen} onClose={() => setIsMapOpen(false)} />
        </>
    );
}
