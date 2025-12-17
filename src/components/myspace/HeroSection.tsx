"use client";

import Image from "next/image";
import { useRouter } from 'next/navigation';
import { useEmotionalStore } from "@/store/useEmotionalStore";
import { Flame, Star, Coffee, Book, Lamp, Palette, Flag } from "lucide-react";

export default function HeroSection() {
    const router = useRouter();
    const { isFireActive, isStarActive, toggleFire, toggleStar } = useEmotionalStore();

    return (
        <div className="relative w-full h-[60vh] min-h-[420px] overflow-hidden rounded-b-[40px] shadow-medium z-10">
            {/* 1. Background Layer */}
            <div className="absolute inset-0 z-0">
                <Image
                    src="/images/tent_view_wide_scenic.png"
                    alt="Tent View"
                    fill
                    className="object-cover"
                    priority
                />

                {/* Darken Overlay (Star Mode) */}
                <div
                    className={`absolute inset-0 bg-[#0a0f1e]/70 transition-opacity duration-1000 pointer-events-none ${isStarActive ? "opacity-100" : "opacity-0"
                        }`}
                />

                {/* Glow Overlay (Fire Mode) */}
                <div
                    className={`absolute inset-0 bg-gradient-to-t from-orange-500/30 via-transparent to-transparent mix-blend-overlay transition-opacity duration-1000 pointer-events-none ${isFireActive ? "opacity-100 animate-pulse" : "opacity-0"
                        }`}
                />

                {/* Vignette for depth */}
                <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-black/40 pointer-events-none" />
            </div>



            {/* 3. Interactive Objects & Widgets Layer */}
            <div className="absolute inset-0 z-20 p-6 flex flex-col justify-between">
                {/* Top Widgets Area */}
                <div className="flex justify-between items-start pt-2">
                    {/* Left: Vertical Stack (Decorate -> Fire -> Star) */}
                    <div className="flex flex-col gap-4">
                        {/* Decorate Widget */}
                        <button className="glass-button p-3.5 rounded-full text-white hover:text-accent-1 active:scale-95 transition-all">
                            <Palette size={22} strokeWidth={1.5} />
                        </button>

                        {/* Fire Widget */}
                        <button
                            onClick={toggleFire}
                            className={`p-3.5 rounded-full backdrop-blur-xl transition-all duration-500 border shadow-lg active:scale-95 ${isFireActive
                                ? "bg-orange-500/90 border-orange-400 text-white shadow-[0_0_25px_rgba(249,115,22,0.5)] transform scale-110"
                                : "bg-black/20 border-white/10 text-white/80 hover:bg-black/30"
                                }`}
                        >
                            <Flame size={22} fill={isFireActive ? "currentColor" : "none"} strokeWidth={1.5} />
                        </button>

                        {/* Star Widget */}
                        <button
                            onClick={toggleStar}
                            className={`p-3.5 rounded-full backdrop-blur-xl transition-all duration-500 border shadow-lg active:scale-95 ${isStarActive
                                ? "bg-indigo-900/90 border-indigo-400 text-yellow-100 shadow-[0_0_25px_rgba(99,102,241,0.5)] transform scale-110"
                                : "bg-black/20 border-white/10 text-white/80 hover:bg-black/30"
                                }`}
                        >
                            <Star size={22} fill={isStarActive ? "currentColor" : "none"} strokeWidth={1.5} />
                        </button>
                    </div>

                    {/* Right: Mission Teaser */}
                    <div className="animate-float">
                        <button className="glass-panel px-4 py-2 rounded-2xl flex items-center gap-2 text-white hover:bg-white/20 transition-colors active:scale-95">
                            <div className="p-1.5 bg-brand-1 rounded-full">
                                <Flag size={14} className="text-white" fill="currentColor" />
                            </div>
                            <div className="flex flex-col items-start">
                                <span className="text-[10px] text-white/80 font-medium">이번 주 미션</span>
                                <span className="text-xs font-bold">가을 낙엽 🍂</span>
                            </div>
                        </button>
                    </div>
                </div>

                {/* Bottom Interactive Objects (Note, Coffee, Lantern) */}
                <div className="flex justify-center gap-10 mb-10">
                    <button
                        onClick={() => router.push('/myspace/records')}
                        className="group flex flex-col items-center gap-2 text-white/90 hover:text-white transition-all active:scale-95"
                    >
                        <div className="p-3.5 glass-dark rounded-full group-hover:bg-white/20 group-active:bg-white/30 transition-all shadow-lg">
                            <Book size={26} strokeWidth={1.5} />
                        </div>
                        <span className="text-[11px] font-medium tracking-wide drop-shadow-md opacity-0 group-hover:opacity-100 transition-opacity absolute -bottom-6">기록</span>
                    </button>

                    <button className="group flex flex-col items-center gap-2 text-white/90 hover:text-white transition-all active:scale-95">
                        <div className="p-3.5 glass-dark rounded-full group-hover:bg-white/20 group-active:bg-white/30 transition-all shadow-lg">
                            <Coffee size={26} strokeWidth={1.5} />
                        </div>
                        <span className="text-[11px] font-medium tracking-wide drop-shadow-md opacity-0 group-hover:opacity-100 transition-opacity absolute -bottom-6">휴식</span>
                    </button>

                    <button className="group flex flex-col items-center gap-2 text-white/90 hover:text-white transition-all active:scale-95">
                        <div className="p-3.5 glass-dark rounded-full group-hover:bg-white/20 group-active:bg-white/30 transition-all shadow-lg">
                            <Lamp size={26} strokeWidth={1.5} />
                        </div>
                        <span className="text-[11px] font-medium tracking-wide drop-shadow-md opacity-0 group-hover:opacity-100 transition-opacity absolute -bottom-6">조명</span>
                    </button>
                </div>
            </div>
        </div>
    );
}
