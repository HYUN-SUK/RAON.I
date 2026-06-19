import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function ReservationDetailLoading() {
    return (
        <main className="min-h-screen bg-[#1a1a1a] text-white pb-24 animate-pulse">
            {/* 상단 이미지 스켈레톤 */}
            <div className="relative h-[40vh] w-full bg-zinc-800 flex items-center justify-center">
                <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-transparent to-[#1a1a1a]" />
                <Link href="/reservation" className="absolute top-6 left-4 p-2 bg-black/20 backdrop-blur-md rounded-full text-white hover:bg-white/10 transition-colors">
                    <ArrowLeft className="w-6 h-6" />
                </Link>
            </div>

            {/* 카드 본문 스켈레톤 */}
            <div className="px-5 -mt-10 relative z-10">
                <div className="bg-[#1a1a1a]/80 backdrop-blur-xl border border-white/10 rounded-t-3xl p-6 shadow-2xl space-y-6">
                    
                    {/* 상단 타이틀 & 가격 영역 */}
                    <div className="flex justify-between items-start mb-4">
                        <div className="space-y-3">
                            {/* 타입 배지 스켈레톤 */}
                            <div className="w-16 h-6 bg-white/10 rounded-md border border-white/5" />
                            {/* 타이틀 스켈레톤 */}
                            <div className="w-48 h-8 bg-white/10 rounded-md" />
                        </div>

                        <div className="text-right space-y-2">
                            {/* 가격 스켈레톤 */}
                            <div className="w-24 h-7 bg-white/10 rounded-md ml-auto" />
                            <div className="w-12 h-4 bg-white/5 rounded-md ml-auto" />
                        </div>
                    </div>

                    {/* 설명글 스켈레톤 */}
                    <div className="space-y-2.5">
                        <div className="w-full h-4 bg-white/10 rounded" />
                        <div className="w-11/12 h-4 bg-white/10 rounded" />
                        <div className="w-4/5 h-4 bg-white/10 rounded" />
                    </div>

                    {/* 편의시설 스켈레톤 */}
                    <div className="space-y-3 pt-2">
                        <div className="w-20 h-5 bg-white/10 rounded-md" />
                        <div className="flex flex-wrap gap-2">
                            <div className="w-16 h-8 bg-white/5 rounded-lg border border-white/10" />
                            <div className="w-20 h-8 bg-white/5 rounded-lg border border-white/10" />
                            <div className="w-24 h-8 bg-white/5 rounded-lg border border-white/10" />
                            <div className="w-14 h-8 bg-white/5 rounded-lg border border-white/10" />
                        </div>
                    </div>

                    {/* 예약 폼 영역 스켈레톤 */}
                    <div className="border-t border-white/10 pt-8 space-y-5">
                        <div className="w-28 h-6 bg-white/10 rounded-md" />
                        
                        <div className="space-y-4">
                            {/* 성함 입력칸 */}
                            <div className="w-full h-11 bg-white/5 rounded-xl border border-white/10" />
                            {/* 연락처 입력칸 */}
                            <div className="w-full h-11 bg-white/5 rounded-xl border border-white/10" />
                            {/* 옵션 박스들 */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="h-20 bg-white/5 rounded-xl border border-white/10" />
                                <div className="h-20 bg-white/5 rounded-xl border border-white/10" />
                            </div>
                            {/* 예약 신청 버튼 */}
                            <div className="w-full h-14 bg-white/10 rounded-xl" />
                        </div>
                    </div>

                </div>
            </div>
        </main>
    );
}
