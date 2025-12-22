import React from 'react';
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { MapPin, Navigation, Phone, Map, Mountain, Tag } from 'lucide-react';
import TopBar from '@/components/TopBar';
import SlimNotice from '@/components/home/SlimNotice';
import { PriceGuideSheet } from '@/components/home/PriceGuideSheet';
import RecommendationGrid from '@/components/home/RecommendationGrid';
import MissionHomeWidget from '@/components/home/MissionHomeWidget';
import { OPEN_DAY_CONFIG } from '@/constants/reservation';
import { format } from 'date-fns';

import { toast } from "sonner";
import { createClient } from "@/lib/supabase-client";

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
    const router = useRouter();
    const supabase = createClient();

    const handleProtectedAction = async (action: () => void) => {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
            toast.info("로그인 후 서비스 이용이 가능합니다", {
                description: "라온아이의 모든 혜택을 누려보세요!",
                action: {
                    label: "로그인",
                    onClick: () => router.push('/login')
                }
            });
            // Optional: Auto redirect after toast or just let user click
            return;
        }
        action();
    };

    return (
        <div className="flex flex-col w-full min-h-screen bg-[#F7F5EF] dark:bg-black relative">
            {/* Global TopBar */}
            <TopBar />

            <main className="flex-1 pb-24 overflow-y-auto scrollbar-hide">
                {/* 1. Hero Section */}
                <section className="relative w-full h-[50vh] min-h-[460px] flex flex-col justify-end p-6">
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
                        </h1>
                        <p className="text-lg font-semibold text-white/95 leading-snug drop-shadow-md">
                            두가족도 넉넉한 2배사이트, 깨끗한 개별욕실<br />
                            라온아이에서 불편은 덜고, 추억은 쌓으세요.
                        </p>
                    </div>
                </section>

                {/* 2. Info Chips (3x2 Grid) */}
                <section className="px-4 -mt-8 relative z-30 mb-8">
                    <div className="grid grid-cols-3 gap-3">
                        {CHIP_GRID.map((chip, idx) => {
                            const ChipContent = (
                                <div className="flex flex-col items-center justify-center aspect-square bg-[#FAF9F6]/95 dark:bg-zinc-800/95 backdrop-blur-md rounded-2xl shadow-[0_4px_16px_-4px_rgba(0,0,0,0.08)] border border-stone-200/50 dark:border-zinc-700/50 hover:bg-[#F5F2EA] dark:hover:bg-zinc-700 hover:scale-[1.02] transition-all duration-300 p-2 cursor-pointer group">
                                    <chip.icon className="w-5 h-5 text-[#3C6E47] group-hover:text-[#1C4526] transition-colors mb-2" />
                                    <p className="text-xs font-bold text-stone-700 dark:text-stone-300 group-hover:text-stone-900 dark:group-hover:text-stone-100 text-center leading-tight transition-colors">{chip.label}</p>
                                    <p className="text-[10px] text-stone-400 group-hover:text-[#C3A675] mt-1 transition-colors">{chip.sub}</p>
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
                                    <p className="text-sm text-stone-600 dark:text-stone-400 mt-1 leading-relaxed break-keep">
                                        오후 2시 입실, 낮 12시 퇴실입니다.<br />
                                        앞,뒤 예약자가 없으면 여유로운 입,퇴실이 가능합니다.
                                    </p>
                                </div>
                            </div>
                        </div>
                        <Button
                            className="w-full mt-6 bg-[#1C4526] hover:bg-[#224732] text-white rounded-xl h-12 shadow-md hover:shadow-lg transition-all active:scale-[0.98]"
                            onClick={() => handleProtectedAction(() => router.push('/reservation'))}
                        >
                            예약 가능 날짜 보기
                        </Button>
                        <p className="text-center text-xs text-stone-400 mt-2">
                            {format(OPEN_DAY_CONFIG.closeAt, 'MM월dd일')}까지 예약가능합니다.
                        </p>
                    </div>
                </section>

                {/* 3.5 Weekly Mission (Moved) */}
                <section className="px-4 mb-8">
                    <MissionHomeWidget />
                </section>

                {/* 4. Recommendations Grid (Dynamic) */}
                <RecommendationGrid onItemClick={(item) => handleProtectedAction(() => {
                    // Logic to navigate or show details based on item
                    toast.success(`${item.title} 확인하기`);
                })} />
            </main>

            {/* Slim Notice Layout Position */}
            <div className="absolute bottom-0 left-0 right-0 z-40">
                <SlimNotice />
            </div>
        </div>
    );
}
