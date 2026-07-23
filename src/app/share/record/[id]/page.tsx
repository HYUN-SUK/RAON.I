'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getPublicRecord, PublicRecordData } from '@/actions/share';
import { Button } from '@/components/ui/button';
import { Loader2, AlertCircle, Sparkles, MapPin, Calendar, Heart, ChevronLeft } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';

export default function PublicRecordPage() {
    const params = useParams();
    const router = useRouter();
    const recordId = params.id as string;

    const [recordData, setRecordData] = useState<PublicRecordData | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isError, setIsError] = useState(false);

    useEffect(() => {
        if (!recordId) {
            setIsLoading(false);
            setIsError(true);
            return;
        }

        const fetchRecord = async () => {
            setIsLoading(true);
            setIsError(false);
            try {
                const data = await getPublicRecord(recordId);
                if (data) {
                    setRecordData(data);
                } else {
                    setIsError(true);
                }
            } catch (err) {
                console.error('[PublicRecordPage] fetch error:', err);
                setIsError(true);
            } finally {
                setIsLoading(false);
            }
        };

        fetchRecord();
    }, [recordId]);

    // 1. Loading State (3-State Rule)
    if (isLoading) {
        return (
            <div className="min-h-screen bg-[#112318] text-white flex flex-col items-center justify-center p-6 space-y-4">
                <Loader2 className="w-10 h-10 text-[#4E8B65] animate-spin" />
                <p className="text-sm font-semibold text-emerald-200/80 animate-pulse">
                    공유된 아지트 기록을 불러오고 있습니다...
                </p>
            </div>
        );
    }

    // 2. Error State (3-State Rule)
    if (isError || !recordData) {
        return (
            <div className="min-h-screen bg-[#112318] text-white flex flex-col items-center justify-center p-6 text-center">
                <div className="w-16 h-16 bg-red-500/10 border border-red-500/20 rounded-full flex items-center justify-center mb-4">
                    <AlertCircle className="w-8 h-8 text-red-400" />
                </div>
                <h1 className="text-xl font-bold text-white mb-2">기록을 찾을 수 없어요</h1>
                <p className="text-xs text-white/60 mb-6 max-w-xs leading-relaxed">
                    삭제되었거나 존재하지 않는 기록 링크입니다. 라온아이에서 나만의 감성 기록을 남겨보세요!
                </p>
                <Button
                    onClick={() => router.push('/')}
                    className="bg-[#224732] hover:bg-[#2d5a40] text-white font-bold rounded-xl px-6 h-11 text-sm shadow-lg"
                >
                    라온아이 홈으로 이동
                </Button>
            </div>
        );
    }

    const formattedDate = recordData.created_at ? new Date(recordData.created_at).toLocaleDateString('ko-KR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    }) : '';

    // 3. Content State (3-State Rule)
    return (
        <div className="min-h-screen bg-[#112318] text-white pb-28">
            {/* Top Bar Header */}
            <header className="sticky top-0 z-40 bg-[#112318]/90 backdrop-blur-md border-b border-white/10 px-4 h-14 flex items-center justify-between">
                <Link href="/" className="flex items-center gap-2 text-white/80 hover:text-white transition-colors">
                    <ChevronLeft className="w-5 h-5" />
                    <span className="text-sm font-bold tracking-tight">라온아이 아지트 기록</span>
                </Link>
                <div className="flex items-center gap-1.5 bg-[#224732] px-2.5 py-1 rounded-full text-[11px] font-semibold text-emerald-200 border border-emerald-500/30">
                    <Sparkles className="w-3 h-3 text-amber-300" />
                    공유된 순간
                </div>
            </header>

            {/* Main Record Card Area */}
            <main className="max-w-md mx-auto p-4 pt-6">
                <div className="bg-[#193525]/90 border border-white/10 rounded-3xl overflow-hidden shadow-2xl">
                    {/* Record Image */}
                    {recordData.image_url ? (
                        <div className="relative w-full h-80 bg-black/40">
                            <Image
                                src={recordData.image_url}
                                alt={recordData.location_name || '아지트 순간'}
                                fill
                                className="object-cover"
                                priority
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-[#193525] via-transparent to-black/30" />
                            {recordData.location_name && (
                                <div className="absolute top-4 left-4 bg-black/50 backdrop-blur-md px-3 py-1.5 rounded-full flex items-center gap-1.5 text-xs text-white border border-white/20">
                                    <MapPin className="w-3.5 h-3.5 text-emerald-400" />
                                    <span>{recordData.location_name}</span>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="w-full h-40 bg-gradient-to-br from-[#224732] to-[#112318] flex items-center justify-center p-6 text-center">
                            <Heart className="w-10 h-10 text-emerald-400/60 mb-2" />
                        </div>
                    )}

                    {/* Card Content Body */}
                    <div className="p-6 space-y-4">
                        {formattedDate && (
                            <div className="flex items-center gap-1.5 text-xs text-emerald-300/80 font-medium">
                                <Calendar className="w-3.5 h-3.5" />
                                <span>{formattedDate}</span>
                            </div>
                        )}

                        {/* Healing Phrase / Content */}
                        {recordData.healing_phrase && (
                            <div className="bg-[#224732]/40 border border-emerald-500/20 rounded-2xl p-4">
                                <p className="text-sm font-medium leading-relaxed text-emerald-100 italic">
                                    "{recordData.healing_phrase}"
                                </p>
                            </div>
                        )}

                        {recordData.content && recordData.content !== recordData.healing_phrase && (
                            <p className="text-xs leading-relaxed text-white/80 whitespace-pre-wrap">
                                {recordData.content}
                            </p>
                        )}

                        <div className="pt-2 border-t border-white/10 flex items-center justify-between text-xs text-white/50">
                            <span>작성자: {recordData.user_nickname || '라온아이 캠퍼'}</span>
                            <span className="text-emerald-400 font-semibold">라온아이 아지트</span>
                        </div>
                    </div>
                </div>
            </main>

            {/* Bottom CTA Fixed Bar */}
            <div className="fixed bottom-0 left-0 right-0 z-50 p-4 bg-gradient-to-t from-[#0a160f] via-[#112318]/95 to-transparent backdrop-blur-md border-t border-white/10">
                <div className="max-w-md mx-auto flex items-center justify-between gap-3">
                    <div className="flex flex-col min-w-0">
                        <p className="text-xs font-bold text-white truncate">당신의 캠핑 순간도 기록해보세요</p>
                        <p className="text-[10px] text-emerald-300/80 truncate">라온아이에서 나만의 10초 아지트 기록 남기기</p>
                    </div>
                    <Button
                        onClick={() => router.push('/')}
                        className="bg-[#224732] hover:bg-[#2e5d42] text-white font-extrabold text-xs px-4 h-11 rounded-xl shadow-lg shrink-0 border border-emerald-400/30 active:scale-95 transition-transform"
                    >
                        기록하러 가기
                    </Button>
                </div>
            </div>
        </div>
    );
}
