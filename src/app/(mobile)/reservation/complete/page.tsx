'use client';

import { useEffect, useState, useRef } from 'react';
import { useReservationStore } from '@/store/useReservationStore';
import { useRouter } from 'next/navigation';
import { format, addHours } from 'date-fns';
import { ko } from 'date-fns/locale';
import { CheckCircle2, Clock, AlertCircle, Copy, Home } from 'lucide-react';
import Image from 'next/image';
import { useReservationGuard } from '@/hooks/useReservationGuard';
import { usePushNotification } from '@/hooks/usePushNotification';
import PushPermissionPrompt from '@/components/permission/PushPermissionPrompt';

export default function ReservationCompletePage() {
    const router = useRouter();
    const { isLoading: isGuardLoading, isAllowed: isGuardAllowed } = useReservationGuard();
    const { reservations, sites, siteConfig, fetchSites, fetchSiteConfig, deadlineHours } = useReservationStore();
    const [latestReservation, setLatestReservation] = useState<any>(null);
    const [copied, setCopied] = useState(false);
    const [showGuideModal, setShowGuideModal] = useState(false);
    const [showPushPrompt, setShowPushPrompt] = useState(false);
    const { requestPermission } = usePushNotification();
    const notificationSentRef = useRef(false);

    useEffect(() => {
        if (typeof window !== 'undefined' && 'Notification' in window) {
            if (Notification.permission !== 'granted') {
                // 예약 완료 최초 로드 시 1.5초 딜레이 후 실시간 알림 동의 권장 팝업 노출
                const timer = setTimeout(() => {
                    setShowPushPrompt(true);
                }, 1500);
                return () => clearTimeout(timer);
            }
        }
    }, []);

    useEffect(() => {
        fetchSites();
        fetchSiteConfig();
    }, [fetchSites, fetchSiteConfig]);

    useEffect(() => {
        if (reservations.length > 0) {
            // [v11.9.108] 과거 취소된 예약 등 인덱스 꼬임을 원천 방지하기 위해 생성시간 순으로 확실하게 정렬
            const latest = [...reservations].sort((a, b) => 
                new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
            )[reservations.length - 1];
            setLatestReservation(latest);
            if (latest.status === 'CONFIRMED' || latest.status === 'PENDING') {
                setShowGuideModal(true);
            }
        } else {
            router.push('/reservation');
        }
    }, [reservations, router, sites, siteConfig, deadlineHours]);

    if (isGuardLoading || !isGuardAllowed || !latestReservation) return null;

    const { status, totalPrice, checkInDate, checkOutDate, siteId, createdAt } = latestReservation;
    const checkIn = new Date(checkInDate);
    const checkOut = new Date(checkOutDate);

    const site = sites.find(s => s.id === siteId);
    const siteName = site ? site.name : siteId;
    const siteImage = site ? site.imageUrl : '/images/site-1.jpg';

    // Calculate deposit deadline (6 hours from creation)
    const created = createdAt ? new Date(createdAt) : new Date();
    const depositDeadline = new Date(created.getTime() + ((deadlineHours || 6) * 60 * 60 * 1000));

    const handleCopyAccount = () => {
        const account = siteConfig?.bankAccount || '3333-00-0000000';
        navigator.clipboard.writeText(account);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="min-h-screen bg-[#F4F8F5] text-[#1E3A26] pb-24">
            {/* ... Header ... */}
            <div className="relative h-64 w-full">
                <Image
                    src={siteImage}
                    alt="Reservation Complete"
                    fill
                    className="object-cover opacity-80"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#F4F8F5] via-[#F4F8F5]/70 to-black/10" />
                <div className="absolute bottom-6 left-6 right-6 text-center">
                    <h1 className="text-3xl font-extrabold text-[#1E4D2B] mb-2">
                        {status === 'PENDING' && '예약 신청 완료'}
                        {status === 'CONFIRMED' && '예약 확정'}
                        {status === 'CANCELLED' && '예약 취소됨'}
                    </h1>
                    <p className="text-[#3A4F3E] font-semibold">
                        {status === 'PENDING' && '입금이 확인되면 예약이 최종 확정됩니다.'}
                        {status === 'CONFIRMED' && '숲으로 떠날 준비가 되셨나요?'}
                        {status === 'CANCELLED' && '입금 기한이 만료되어 취소되었습니다.'}
                    </p>
                </div>
            </div>

            <div className="px-6 -mt-6 relative z-10 space-y-6">
                {/* Status Card */}
                <div className="bg-white rounded-2xl p-6 border border-[#D2E5D7] shadow-md">
                    <div className="flex items-center gap-3 mb-4">
                        {status === 'PENDING' && <Clock className="w-6 h-6 text-[#D9963E]" />}
                        {status === 'CONFIRMED' && <CheckCircle2 className="w-6 h-6 text-[#2E7D47]" />}
                        {status === 'CANCELLED' && <AlertCircle className="w-6 h-6 text-red-500" />}
                        <span className="text-lg font-extrabold text-[#1E4D2B]">
                            {status === 'PENDING' && '입금 대기 중'}
                            {status === 'CONFIRMED' && '예약 확정됨'}
                            {status === 'CANCELLED' && '자동 취소됨'}
                        </span>
                    </div>

                    {/* Pending State: Bank Info */}
                    {status === 'PENDING' && (
                        <div className="bg-[#EDF5EE] border border-[#C5DFC9] rounded-xl p-4 space-y-3 mb-4">
                            <div className="flex justify-between items-center">
                                <span className="text-[#5A6E5E] text-sm font-medium">입금 계좌</span>
                                <div className="flex items-center gap-2">
                                    <span className="font-mono font-extrabold text-[#2E7D47]">
                                        {siteConfig ? `${siteConfig.bankName} ${siteConfig.bankAccount}` : '계좌정보 로딩중...'}
                                    </span>
                                    <button onClick={handleCopyAccount} className="p-1 hover:bg-[#D2E5D7]/60 rounded">
                                        <Copy className="w-4 h-4 text-[#2E7D47]" />
                                    </button>
                                </div>
                            </div>
                            {copied && <p className="text-xs text-[#2E7D47] font-bold text-right">복사되었습니다!</p>}
                            <div className="flex justify-between items-center">
                                <span className="text-[#5A6E5E] text-sm font-medium">예금주</span>
                                <span className="font-bold text-[#1E3A26]">{siteConfig?.bankHolder || '라온아이'}</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-[#5A6E5E] text-sm font-medium">입금 금액</span>
                                <span className="font-extrabold text-xl text-[#1A3822]">{totalPrice.toLocaleString()}원</span>
                            </div>
                            <div className="flex justify-between items-start pt-2 border-t border-[#C5DFC9] mt-2">
                                <span className="text-[#5A6E5E] text-sm font-medium shrink-0 mr-2">입금 기한</span>
                                <div className="text-right">
                                    <span className="text-[#DC2626] font-extrabold block">
                                        {format(depositDeadline, 'MM.dd HH:mm', { locale: ko })} 까지
                                    </span>
                                    <span className="text-[11px] text-[#6B7E70] block mt-1">
                                        * 기한 내 미입금 시 자동 취소됩니다.
                                    </span>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Confirmed State: Rules */}
                    {status === 'CONFIRMED' && (
                        <div className="bg-[#EDF5EE] border border-[#C5DFC9] rounded-xl p-4 mb-4">
                            <h3 className="font-bold text-[#2E7D47] mb-2">이용 안내</h3>
                            <ul className="text-sm text-[#2D5A3C] space-y-1 list-disc list-inside">
                                <li>입실 시간: 14:00</li>
                                <li>퇴실 시간: 12:00</li>
                                <li>매너 타임: 22:00 ~ 07:00 (조용히 부탁드려요)</li>
                            </ul>
                        </div>
                    )}

                    {/* Reservation Details */}
                    <div className="border-t border-[#E2EFE5] pt-4 space-y-2">
                        <div className="flex justify-between">
                            <span className="text-[#5A6E5E] font-medium">일정</span>
                            <span className="font-bold text-[#1E3A26]">{format(checkIn, 'MM.dd(eee)', { locale: ko })} - {format(checkOut, 'MM.dd(eee)', { locale: ko })}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-[#5A6E5E] font-medium">사이트</span>
                            <span className="font-bold text-[#1E3A26]">{siteName}</span>
                        </div>
                    </div>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3">
                    <button
                        onClick={() => router.push('/')}
                        className="flex-1 bg-white hover:bg-[#EDF5EE] text-[#1E4D2B] border border-[#C5DFC9] py-4 rounded-xl font-bold transition-colors flex items-center justify-center gap-2 shadow-2xs"
                    >
                        <Home className="w-5 h-5" />
                        홈으로
                    </button>
                    <button
                        onClick={() => router.push('/myspace')}
                        className="flex-1 bg-[#2E7D47] hover:bg-[#256639] text-white py-4 rounded-xl font-bold transition-colors shadow-sm"
                    >
                        내 수첩으로 가기
                    </button>
                </div>
            </div>

            {/* 예약 완료 및 스마트플랜 안내 모달 */}
            {showGuideModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
                    <div className="bg-white text-[#1E3A26] rounded-3xl p-6 max-w-sm w-full shadow-2xl text-center border border-[#D2E5D7] flex flex-col items-center animate-fade-in">
                        <span className="text-3xl">✨</span>
                        <h3 className="text-base font-extrabold text-[#1E4D2B] mt-3">
                            {status === 'CONFIRMED' ? '예약이 확정되었습니다!' : '예약 신청이 접수되었습니다!'}
                        </h3>
                        <p className="text-xs text-[#4A5D4E] font-medium mt-2 leading-relaxed whitespace-pre-line">
                            {status === 'CONFIRMED'
                                ? `예약이 확정되었습니다.\n⚡ 즉시 여행계획 생성가능!, 터치해보세요!`
                                : `입금 후 예약확정 시 최적화됩니다.\n⚡ 즉시 여행계획 생성가능!, 터치해보세요!`
                            }
                        </p>
                        <button
                            onClick={() => setShowGuideModal(false)}
                            className="mt-6 w-full bg-[#2E7D47] hover:bg-[#256639] text-white rounded-xl py-3 font-bold text-xs transition-colors shadow-xs"
                        >
                            확인
                        </button>
                    </div>
                </div>
            )}

            <PushPermissionPrompt
                isOpen={showPushPrompt}
                onAccept={async () => {
                    await requestPermission();
                    setShowPushPrompt(false);
                }}
                onDismiss={() => setShowPushPrompt(false)}
            />
        </div>
    );
}
