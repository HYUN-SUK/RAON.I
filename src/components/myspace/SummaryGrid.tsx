"use client";

import { Image as ImageIcon, History, Map, Award } from "lucide-react";

export default function SummaryGrid() {
    const items = [
        { icon: ImageIcon, label: "앨범", color: "text-blue-600", bg: "bg-blue-50" },
        { icon: History, label: "히스토리", color: "text-purple-600", bg: "bg-purple-50" },
        { icon: Award, label: "포인트", color: "text-amber-600", bg: "bg-amber-50" },
        { icon: Map, label: "나만의 지도", color: "text-emerald-600", bg: "bg-emerald-50" },
    ];

    return (
        <div className="grid grid-cols-2 gap-4 px-6 pb-8">
            {items.map((item) => (
                <button
                    key={item.label}
                    className="group flex flex-col items-center justify-center p-5 bg-white rounded-3xl shadow-soft border border-transparent hover:border-surface-2 hover:shadow-medium active:scale-95 transition-all duration-300 transform hover:-translate-y-1"
                >
                    <div className={`p-3.5 rounded-2xl ${item.bg} ${item.color} mb-3 transition-transform group-hover:scale-110 duration-300`}>
                        <item.icon size={22} strokeWidth={2} />
                    </div>
                    <span className="text-sm font-semibold text-text-2 group-hover:text-text-1 transition-colors">{item.label}</span>
                </button>
            ))}
        </div>
    );
}
