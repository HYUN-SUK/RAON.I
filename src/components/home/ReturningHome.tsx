import React from 'react';
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ChevronRight, Tent, RefreshCcw } from 'lucide-react';
import TopBar from '@/components/TopBar';
import { useRouter } from 'next/navigation';
import { useReservationStore } from '@/store/useReservationStore';
import RecommendationGrid from '@/components/home/RecommendationGrid';
import SlimNotice from '@/components/home/SlimNotice';
import { OPEN_DAY_CONFIG } from '@/constants/reservation';
import { format } from 'date-fns';

export default function ReturningHome() {
    const router = useRouter();
    const { initRebook } = useReservationStore();
    return (
        <div className="flex flex-col w-full min-h-screen bg-[#F7F5EF] dark:bg-black relative">
            {/* Global TopBar */}
            <TopBar />

            <main className="flex-1 pb-24 overflow-y-auto scrollbar-hide">
                {/* 1. Personalized Hero Panel */}
                <section className="w-full bg-[#1C4526] text-white pt-6 pb-20 px-6 rounded-b-[40px] shadow-lg relative overflow-hidden">
                    {/* Background Image Overlay */}
                    <div className="absolute inset-0 z-0 opacity-20 bg-[url('https://images.unsplash.com/photo-1523987355523-c7b5b0dd90a7?q=80&w=1000&auto=format&fit=crop')] bg-cover bg-center" />

                    {/* Abstract Pattern */}
                    <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none" />

                    <div className="relative z-10 mt-4">
                        <p className="text-white/80 text-sm mb-1">반가워요, 김캠퍼님</p>
                        <h1 className="text-2xl font-bold leading-relaxed">
                            라온아이에서,<br />
                            나의 캠핑 이야기를 이어가세요.
                        </h1>
                    </div>
                </section>

                {/* 2. Floating Reservation / My Space Card */}
                <div className="px-4 -mt-12 relative z-20 mb-8">
                    <Card className="w-full bg-white dark:bg-zinc-900 border-none shadow-xl rounded-2xl overflow-hidden p-0">
                        <div className="p-5">
                            <div className="flex justify-between items-center mb-4">
                                <h2 className="text-lg font-bold text-stone-800 dark:text-stone-100">나의 예약</h2>
                                <Button variant="ghost" size="sm" className="text-stone-400 hover:text-stone-600 h-8 px-2">
                                    더보기 <ChevronRight className="w-4 h-4 ml-1" />
                                </Button>
                            </div>

                            {/* Zero-click Smart Re-booking (Roadmap v3) */}
                            <div className="mb-4 bg-[#F7F5EF] dark:bg-zinc-800 rounded-xl p-4 border border-[#1C4526]/10">
                                <div className="flex justify-between items-start mb-3">
                                    <div>
                                        <Badge className="bg-[#1C4526] text-white hover:bg-[#1C4526] mb-1.5 px-2 py-0.5 text-[10px]">Smart Re-book</Badge>
                                        <p className="font-bold text-stone-800 dark:text-stone-100 text-sm">지난 여행 조건으로 예약하기</p>
                                        <p className="text-xs text-stone-500 mt-0.5">인원, 차량, 사이트 설정을 불러옵니다.</p>
                                    </div>
                                    <div className="w-8 h-8 rounded-full bg-stone-100 dark:bg-zinc-700 flex items-center justify-center">
                                        <RefreshCcw className="w-4 h-4 text-stone-500" />
                                    </div>
                                </div>

                                <div className="flex items-center gap-3 bg-white dark:bg-zinc-900 p-3 rounded-lg border border-stone-200 dark:border-zinc-700 mb-3 shadow-sm">
                                    <div className="w-10 h-10 rounded-lg bg-stone-100 flex items-center justify-center text-xl">⛺</div>
                                    <div>
                                        <h3 className="font-semibold text-xs text-stone-800 dark:text-stone-200">담이네 (A-7)</h3>
                                        <p className="text-[10px] text-stone-500">성인 2, 아이 2 · 차량 1대</p>
                                    </div>
                                </div>
                                <Button
                                    className="w-full bg-[#1C4526] hover:bg-[#224732] text-white h-10 text-xs font-semibold rounded-lg shadow-md transition-all active:scale-[0.96] duration-200"
                                    onClick={() => {
                                        initRebook('site-7');
                                        router.push('/reservation');
                                    }}
                                >
                                    빠르게 재예약하기 (날짜 선택)
                                </Button>
                                <p className="text-center text-xs text-stone-400 mt-2">
                                    {format(OPEN_DAY_CONFIG.closeAt, 'MM월dd일')}까지 예약가능합니다.
                                </p>
                            </div>
                        </div>

                        {/* Return to Tent Button */}
                        <div className="pt-2 border-t border-stone-100 dark:border-zinc-800">
                            <Button
                                size="lg"
                                className="w-full bg-stone-900 hover:bg-black text-white rounded-xl h-12 text-sm font-bold flex items-center justify-between px-6 shadow-lg shadow-stone-200 dark:shadow-none transition-transform active:scale-[0.98]"
                                onClick={() => router.push('/myspace')}
                            >
                                <div className="flex items-center gap-2">
                                    <Tent className="w-5 h-5 text-[#C3A675]" />
                                    <span>내 텐트로 돌아가기</span>
                                </div>
                                <ChevronRight className="w-4 h-4 text-stone-500" />
                            </Button>
                        </div>
                    </Card>
                </div>

                {/* 3. Recommendations Grid (Dynamic) */}
                <RecommendationGrid />
            </main>

            {/* Slim Notice Layout Position */}
            <div className="absolute bottom-0 left-0 right-0 z-40">
                <SlimNotice />
            </div>
        </div>
    );
}
