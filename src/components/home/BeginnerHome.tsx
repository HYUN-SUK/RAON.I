import React from 'react';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MapPin, Navigation, Phone, Map, Mountain, Tag } from 'lucide-react';
import TopBar from '@/components/TopBar';
import SlimNotice from '@/components/home/SlimNotice';
import { PriceGuideSheet } from '@/components/home/PriceGuideSheet';

// InfoChip Data (3x2 Grid)
// [Address, Wayfinding, Contact, Map, Nearby, Price Guide]
const CHIP_GRID = [
    { icon: MapPin, label: "주소 복사", sub: "강원 춘천시..." },
    { icon: Navigation, label: "길찾기", sub: "카카오/티맵" },
    { icon: Phone, label: "연락처", sub: "010-1234..." },
    { icon: Map, label: "배치도", sub: "시설 위치" },
    { icon: Mountain, label: "인근 명소", sub: "관광지 안내" },
    { icon: Tag, label: "가격 가이드", sub: "포함 내역", isPriceGuide: true }, // Special Trigger
];

export default function BeginnerHome() {
    return (
        <div className="flex flex-col w-full min-h-screen bg-[#F7F5EF] dark:bg-black relative">
            {/* Global TopBar */}
            <TopBar />

            <main className="flex-1 pb-24 overflow-y-auto scrollbar-hide">
                {/* 1. Hero Section */}
                <section className="relative w-full h-[460px] flex flex-col justify-end p-6">
                    {/* Background Image (Placeholder) */}
                    <div className="absolute inset-0 z-0 bg-stone-300">
                        {/* Placeholder for Hero Image */}
                        <div className="w-full h-full bg-stone-400 bg-[url('https://images.unsplash.com/photo-1478131143081-80f7f84ca84d?q=80&w=1000&auto=format&fit=crop')] bg-cover bg-center grayscale-[20%]" />
                    </div>

                    {/* Gradient Overlay */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent z-10" />

                    <div className="relative z-20 text-white space-y-4 mb-6">
                        <Badge variant="secondary" className="bg-white/20 text-white hover:bg-white/30 backdrop-blur-sm border-none px-3 py-1">
                            Welcome to RAON.I
                        </Badge>
                        <h1 className="text-3xl font-bold leading-tight">
                            처음이신가요?<br />
                            <span className="text-white/90 font-medium text-2xl">가장 쉬운 캠핑을 준비했어요.</span>
                        </h1>
                        <p className="text-sm text-gray-200 opacity-90 leading-relaxed">
                            두 가족도 넉넉한 2배 사이트,<br />
                            몸만 와도 충분한 편의시설을 경험하세요.
                        </p>
                    </div>
                </section>

                {/* 2. Info Chips (3x2 Grid) */}
                <section className="px-4 -mt-8 relative z-30 mb-8">
                    <div className="grid grid-cols-3 gap-2">
                        {CHIP_GRID.map((chip, idx) => {
                            const ChipContent = (
                                <div className="flex flex-col items-center justify-center aspect-square bg-white dark:bg-zinc-900 rounded-2xl shadow-sm border border-stone-100 dark:border-zinc-800 hover:bg-stone-50 dark:hover:bg-zinc-800 transition-colors p-2 cursor-pointer">
                                    <chip.icon className="w-5 h-5 text-[#3C6E47] mb-2" />
                                    <p className="text-xs font-bold text-stone-800 dark:text-stone-200 text-center leading-tight">{chip.label}</p>
                                    <p className="text-[10px] text-stone-500 mt-1">{chip.sub}</p>
                                </div>
                            );

                            if (chip.isPriceGuide) {
                                return (
                                    <PriceGuideSheet key={idx}>
                                        {ChipContent}
                                    </PriceGuideSheet>
                                )
                            }
                            return <div key={idx}>{ChipContent}</div>
                        })}
                    </div>
                </section>

                {/* 3. Guide Card */}
                <section className="px-4 mb-8">
                    <div className="w-full bg-white dark:bg-zinc-900 rounded-3xl p-6 shadow-sm border border-stone-100 dark:border-zinc-800">
                        <h3 className="text-xl font-bold text-[#1C4526] mb-4">처음 오셨나요?</h3>
                        <div className="space-y-6">
                            <div className="flex gap-4">
                                <div className="flex-none flex items-center justify-center w-8 h-8 rounded-full bg-[#E8F5E9] text-[#1C4526] font-bold">1</div>
                                <div>
                                    <h4 className="font-semibold text-stone-900 dark:text-stone-100">예약하기</h4>
                                    <p className="text-sm text-stone-600 dark:text-stone-400 mt-1 leading-relaxed">
                                        원하는 날짜와 사이트를 선택하세요.<br />
                                        여유로운 캠핑을 위해 미리 준비하면 좋아요.
                                    </p>
                                </div>
                            </div>
                            <div className="flex gap-4">
                                <div className="flex-none flex items-center justify-center w-8 h-8 rounded-full bg-[#E8F5E9] text-[#1C4526] font-bold">2</div>
                                <div>
                                    <h4 className="font-semibold text-stone-900 dark:text-stone-100">입,퇴실 안내</h4>
                                    <p className="text-sm text-stone-600 dark:text-stone-400 mt-1 leading-relaxed">
                                        오후 2시 입실, 낮 12시 퇴실입니다.<br />
                                        여유롭게 오셔서 자연을 즐기세요.
                                    </p>
                                </div>
                            </div>
                        </div>
                        <Button className="w-full mt-6 bg-[#1C4526] hover:bg-[#224732] text-white rounded-xl h-12">
                            예약 가능 날짜 보기
                        </Button>
                    </div>
                </section>

                {/* 4. Recommendations Grid (Play, Cook, Event, Mission) */}
                <section className="px-4 mb-8">
                    <div className="flex justify-between items-end mb-4 px-1">
                        <h3 className="text-xl font-bold text-[#1C4526]">오늘의 추천</h3>
                        <span className="text-xs text-stone-500">더보기</span>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        {/* Play */}
                        <div className="bg-orange-50 dark:bg-orange-950/20 p-4 rounded-2xl flex flex-col justify-between h-32">
                            <span className="text-2xl">🔥</span>
                            <div>
                                <p className="text-xs text-orange-600 font-bold mb-1">놀이</p>
                                <p className="text-sm font-semibold text-stone-800 dark:text-stone-100">불멍하기 좋은 날</p>
                            </div>
                        </div>
                        {/* Cook */}
                        <div className="bg-blue-50 dark:bg-blue-950/20 p-4 rounded-2xl flex flex-col justify-between h-32">
                            <span className="text-2xl">🍳</span>
                            <div>
                                <p className="text-xs text-blue-600 font-bold mb-1">요리</p>
                                <p className="text-sm font-semibold text-stone-800 dark:text-stone-100">따뜻한 어묵탕</p>
                            </div>
                        </div>
                        {/* Event */}
                        <div className="bg-purple-50 dark:bg-purple-950/20 p-4 rounded-2xl flex flex-col justify-between h-32">
                            <span className="text-2xl">🎉</span>
                            <div>
                                <p className="text-xs text-purple-600 font-bold mb-1">행사</p>
                                <p className="text-sm font-semibold text-stone-800 dark:text-stone-100">별보기 투어</p>
                            </div>
                        </div>
                        {/* Mission */}
                        <div className="bg-green-50 dark:bg-green-950/20 p-4 rounded-2xl flex flex-col justify-between h-32">
                            <span className="text-2xl">🌱</span>
                            <div>
                                <p className="text-xs text-green-600 font-bold mb-1">미션</p>
                                <p className="text-sm font-semibold text-stone-800 dark:text-stone-100">쓰레기 줍기</p>
                            </div>
                        </div>
                    </div>
                </section>
            </main>

            {/* Slim Notice Layout Position */}
            <div className="absolute bottom-0 left-0 right-0 z-40">
                <SlimNotice />
            </div>
        </div>
    );
}
