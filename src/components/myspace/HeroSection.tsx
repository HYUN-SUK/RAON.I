"use client";

import Image from "next/image";
import { Camera, Flag } from "lucide-react";
import { useMissionStore } from "@/store/useMissionStore";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function HeroSection() {
    const router = useRouter();
    const { currentMission, fetchCurrentMission } = useMissionStore();

    useEffect(() => {
        fetchCurrentMission();
    }, [fetchCurrentMission]);

    return (
        <div className="relative w-full h-[55vh] min-h-[400px] rounded-b-[40px] shadow-medium z-10 bg-surface-2 group">
            <div className="absolute inset-0 rounded-b-[40px] overflow-hidden z-0">
                <Image
                    src="/images/tent_view_wide_scenic.png"
                    alt="My Archive"
                    fill
                    className="object-cover"
                    priority
                />

                {/* Cinematic Gradient Overlay */}
                <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-transparent to-black/50 pointer-events-none" />
            </div>

            {/* 2. UI Overlay Layer */}
            <div className="absolute inset-0 z-20 p-6 flex flex-col justify-between pointer-events-none">
                {/* Top Area: Mission Badge & Edit Control */}
                <div className="flex justify-between items-start pt-8">
                    {/* Left: Empty (clean look) or Date */}
                    <div />

                    {/* Right: Mission Badge (Subtle) */}
                    {currentMission && (
                        <div className="animate-float z-50 pointer-events-auto">
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    router.push(`/mission/${currentMission.id}`);
                                }}
                                className="glass-panel px-4 py-2 rounded-full flex items-center gap-2 text-white/90 hover:bg-white/20 active:scale-95 transition-all shadow-lg"
                            >
                                <div className="p-1 bg-brand-1 rounded-full">
                                    <Flag size={12} className="text-white" fill="currentColor" />
                                </div>
                                <span className="text-xs font-medium">
                                    이번 주: {currentMission.title.length > 8 ? currentMission.title.substring(0, 8) + '...' : currentMission.title}
                                </span>
                            </button>
                        </div>
                    )}
                </div>

                {/* Bottom Area: Photo Controls */}
                <div className="flex justify-end items-end pb-2">
                    <button className="glass-button p-3 rounded-full text-white hover:bg-white/20 active:scale-95 transition-all flex items-center gap-2 group">
                        <Camera size={20} strokeWidth={1.5} />
                        <span className="text-sm font-medium w-0 overflow-hidden group-hover:w-16 transition-all duration-300 whitespace-nowrap">사진 변경</span>
                    </button>
                </div>
            </div>
        </div>
    );
}
