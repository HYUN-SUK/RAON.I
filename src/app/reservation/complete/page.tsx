'use client';

import { useEffect, useState } from 'react';
import { useReservationStore } from '@/store/useReservationStore';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { CheckCircle2, Clock, AlertCircle, Copy, Home } from 'lucide-react';
import Image from 'next/image';

export default function ReservationCompletePage() {
    const router = useRouter();
    const { reservations } = useReservationStore();
    const [latestReservation, setLatestReservation] = useState<any>(null);
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        if (reservations.length > 0) {
            // Get the most recent reservation
            setLatestReservation(reservations[reservations.length - 1]);
        } else {
            // No reservation found, redirect to home or reservation list
            router.push('/reservation');
        }
    }, [reservations, router]);

    if (!latestReservation) return null;

    const { status, totalPrice, checkInDate, checkOutDate, siteId } = latestReservation;
    const checkIn = new Date(checkInDate);
    const checkOut = new Date(checkOutDate);

    const handleCopyAccount = () => {
        navigator.clipboard.writeText('3333-00-0000000');
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="min-h-screen bg-[#121212] text-white pb-24">
            {/* Header Image Area */}
            <div className="relative h-64 w-full">
                <Image
                    src="/images/site-1.jpg" // Fallback or dynamic based on siteId
                    alt="Reservation Complete"
                    fill
                    className="object-cover opacity-50"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#121212] via-[#121212]/50 to-transparent" />
                <div className="absolute bottom-6 left-6 right-6">
                    <h1 className="text-3xl font-bold mb-2">
                        {status === 'PENDING' && '예약 신청 완료'}
                        {status === 'CONFIRMED' && '예약 확정'}
                        {status === 'CANCELLED' && '예약 취소됨'}
                    </h1>
                    <p className="text-white/70">
                        {status === 'PENDING' && '입금이 확인되면 예약이 최종 확정됩니다.'}
                        {status === 'CONFIRMED' && '숲으로 떠날 준비가 되셨나요?'}
                        {status === 'CANCELLED' && '입금 기한이 만료되어 취소되었습니다.'}
                    </p>
                </div>
            </div>

            <div className="px-6 -mt-6 relative z-10 space-y-6">
                {/* Status Card */}
                <div className="bg-[#1E1E1E] rounded-2xl p-6 border border-white/10 shadow-xl">
                    <div className="flex items-center gap-3 mb-4">
                        {status === 'PENDING' && <Clock className="w-6 h-6 text-yellow-500" />}
                        {status === 'CONFIRMED' && <CheckCircle2 className="w-6 h-6 text-[#2F5233]" />}
                        {status === 'CANCELLED' && <AlertCircle className="w-6 h-6 text-red-500" />}
                        <span className="text-lg font-bold">
                            {status === 'PENDING' && '입금 대기 중'}
                            {status === 'CONFIRMED' && '예약 확정됨'}
                            {status === 'CANCELLED' && '자동 취소됨'}
                        </span>
                    </div>

                    {/* Pending State: Bank Info */}
                    {status === 'PENDING' && (
                        <div className="bg-white/5 rounded-xl p-4 space-y-3 mb-4">
                            <div className="flex justify-between items-center">
                                <span className="text-white/60 text-sm">입금 계좌</span>
                                <div className="flex items-center gap-2">
                                    <span className="font-mono font-bold text-[#C3A675]">카카오뱅크 3333-00-0000000</span>
                                    <button onClick={handleCopyAccount} className="p-1 hover:bg-white/10 rounded">
                                        <Copy className="w-4 h-4 text-white/50" />
                                    </button>
                                </div>
                            </div>
                            {copied && <p className="text-xs text-green-500 text-right">복사되었습니다!</p>}
                            <div className="flex justify-between items-center">
                                <span className="text-white/60 text-sm">예금주</span>
                                <span>라온아이</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-white/60 text-sm">입금 금액</span>
                                <span className="font-bold text-xl">{totalPrice.toLocaleString()}원</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-white/60 text-sm">입금 기한</span>
                                <span className="text-red-400 text-sm">내일 23:59까지</span>
                            </div>
                        </div>
                    )}

                    {/* Confirmed State: Rules */}
                    {status === 'CONFIRMED' && (
                        <div className="bg-[#2F5233]/20 border border-[#2F5233]/50 rounded-xl p-4 mb-4">
                            <h3 className="font-bold text-[#2F5233] mb-2">이용 안내</h3>
                            <ul className="text-sm text-white/80 space-y-1 list-disc list-inside">
                                <li>입실 시간: 14:00</li>
                                <li>퇴실 시간: 12:00</li>
                                <li>매너 타임: 22:00 ~ 07:00 (조용히 부탁드려요)</li>
                            </ul>
                        </div>
                    )}

                    {/* Reservation Details */}
                    <div className="border-t border-white/10 pt-4 space-y-2">
                        <div className="flex justify-between">
                            <span className="text-white/60">일정</span>
                            <span>{format(checkIn, 'MM.dd(eee)', { locale: ko })} - {format(checkOut, 'MM.dd(eee)', { locale: ko })}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-white/60">사이트</span>
                            <span>{siteId}</span>
                        </div>
                    </div>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3">
                    <button
                        onClick={() => router.push('/')}
                        className="flex-1 bg-white/10 hover:bg-white/20 text-white py-4 rounded-xl font-bold transition-colors flex items-center justify-center gap-2"
                    >
                        <Home className="w-5 h-5" />
                        홈으로
                    </button>
                    <button
                        onClick={() => router.push('/myspace')}
                        className="flex-1 bg-[#2F5233] hover:bg-[#233e26] text-white py-4 rounded-xl font-bold transition-colors"
                    >
                        내 공간으로 이동
                    </button>
                </div>
            </div>
        </div>
    );
}
