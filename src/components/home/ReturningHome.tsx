import React from 'react';
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ChevronRight, Tent, Calendar, Clock, RefreshCcw } from 'lucide-react';
import TopBar from '@/components/TopBar';
import SlimNotice from '@/components/home/SlimNotice';

export default function ReturningHome() {
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
                                        <p className="font-semibold text-xs text-stone-800 dark:text-stone-200">A-7 구역 (파쇄석)</p>
                                        <p className="text-[10px] text-stone-500">성인 2, 아이 2 · 차량 1대</p>
                                    </div>
                                </div>
                                <Button className="w-full bg-[#1C4526] hover:bg-[#224732] text-white h-10 text-xs font-semibold rounded-lg shadow-md transition-all active:scale-[0.96] duration-200">
                                    1초만에 재예약하기 (날짜 선택)
                                </Button>
                            </div>

                            {/* Return to Tent Button */}
                            <div className="pt-2 border-t border-stone-100 dark:border-zinc-800">
                                <Button
                                    size="lg"
                                    className="w-full bg-stone-900 hover:bg-black text-white rounded-xl h-12 text-sm font-bold flex items-center justify-between px-6 shadow-lg shadow-stone-200 dark:shadow-none"
                                >
                                    <div className="flex items-center gap-2">
                                        <Tent className="w-5 h-5 text-[#C3A675]" />
                                        <span>내 텐트로 돌아가기</span>
                                    </div>
                                    <ChevronRight className="w-4 h-4 text-stone-500" />
                                </Button>
                            </div>
                        </div>
                    </Card>
                </div>

                {/* 3. Recommendations Grid (Play, Cook, Event, Mission) */}
                <section className="px-4 mb-8">
                    <div className="flex justify-between items-end mb-4 px-1">
                        <h3 className="text-xl font-bold text-stone-800 dark:text-stone-100">오늘의 추천</h3>
                        <span className="text-xs text-stone-500">더보기</span>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        {/* Play */}
                        <div className="bg-orange-50 dark:bg-orange-950/20 p-4 rounded-2xl flex flex-col justify-between h-32 border border-orange-100 dark:border-orange-900/30">
                            <span className="text-2xl">🔥</span>
                            <div>
                                <p className="text-xs text-orange-600 font-bold mb-1">놀이</p>
                                <p className="text-sm font-semibold text-stone-800 dark:text-stone-100">불멍하기 좋은 날</p>
                            </div>
                        </div>
                        {/* Cook */}
                        <div className="bg-blue-50 dark:bg-blue-950/20 p-4 rounded-2xl flex flex-col justify-between h-32 border border-blue-100 dark:border-blue-900/30">
                            <span className="text-2xl">🍳</span>
                            <div>
                                <p className="text-xs text-blue-600 font-bold mb-1">요리</p>
                                <p className="text-sm font-semibold text-stone-800 dark:text-stone-100">따뜻한 어묵탕</p>
                            </div>
                        </div>
                        {/* Event */}
                        <div className="bg-purple-50 dark:bg-purple-950/20 p-4 rounded-2xl flex flex-col justify-between h-32 border border-purple-100 dark:border-purple-900/30">
                            <span className="text-2xl">🎉</span>
                            <div>
                                <p className="text-xs text-purple-600 font-bold mb-1">행사</p>
                                <p className="text-sm font-semibold text-stone-800 dark:text-stone-100">별보기 투어</p>
                            </div>
                        </div>
                        {/* Mission */}
                        <div className="bg-green-50 dark:bg-green-950/20 p-4 rounded-2xl flex flex-col justify-between h-32 border border-green-100 dark:border-green-900/30">
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
