'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, FileText, MapPin, Clock, ShieldCheck, Mail, User } from 'lucide-react';
import { Button } from '@/components/ui/button';

function TermsContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const initialTab = searchParams.get('tab') === 'lbs' ? 'lbs' : 'service';
    const [activeTab, setActiveTab] = useState<'service' | 'lbs'>(initialTab);

    useEffect(() => {
        const tab = searchParams.get('tab');
        if (tab === 'lbs') {
            setActiveTab('lbs');
        } else if (tab === 'service') {
            setActiveTab('service');
        }
    }, [searchParams]);

    const handleTabChange = (tab: 'service' | 'lbs') => {
        setActiveTab(tab);
        const url = tab === 'lbs' ? '/terms?tab=lbs' : '/terms';
        router.replace(url);
    };

    return (
        <div className="min-h-screen bg-[#F7F5EF] text-stone-800 antialiased">
            {/* Header */}
            <header className="sticky top-0 z-50 bg-[#1C4526] text-white py-4 px-4 shadow-md">
                <div className="max-w-lg mx-auto flex items-center gap-3">
                    <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => router.back()} 
                        className="text-white hover:bg-white/10 rounded-full"
                    >
                        <ArrowLeft className="w-6 h-6" />
                    </Button>
                    <h1 className="text-lg font-bold">이용약관</h1>
                </div>
            </header>

            {/* Content Container */}
            <main className="max-w-lg mx-auto px-5 py-6 bg-white min-h-[calc(100vh-64px)] shadow-sm border-x border-stone-100">
                {/* Tab Switcher */}
                <div className="flex rounded-xl bg-stone-100 p-1 mb-6 border border-stone-200/80">
                    <button
                        onClick={() => handleTabChange('service')}
                        className={`flex-1 py-2.5 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                            activeTab === 'service'
                                ? 'bg-white text-[#1C4526] shadow-sm font-extrabold'
                                : 'text-stone-500 hover:text-stone-700'
                        }`}
                    >
                        <FileText size={14} className={activeTab === 'service' ? 'text-[#1C4526]' : 'text-stone-400'} />
                        <span>서비스 이용약관</span>
                    </button>
                    <button
                        onClick={() => handleTabChange('lbs')}
                        className={`flex-1 py-2.5 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                            activeTab === 'lbs'
                                ? 'bg-white text-[#1C4526] shadow-sm font-extrabold'
                                : 'text-stone-500 hover:text-stone-700'
                        }`}
                    >
                        <MapPin size={14} className={activeTab === 'lbs' ? 'text-[#1C4526]' : 'text-stone-400'} />
                        <span>위치기반서비스 이용약관</span>
                    </button>
                </div>

                {/* TAB 1: 서비스 이용약관 */}
                {activeTab === 'service' && (
                    <div>
                        <div className="flex items-center gap-2 pb-4 mb-6 border-b border-stone-100">
                            <FileText className="w-6 h-6 text-[#1C4526]" />
                            <h2 className="text-xl font-extrabold text-stone-900 tracking-tight">서비스 이용약관</h2>
                        </div>

                        <p className="text-xs text-stone-500 mb-8 leading-relaxed">
                            {"본 약관은 '라온아이(RAON.I) 오토캠핑장'(이하 '캠핑장')이 제공하는 온라인 예약 및 관련 서비스(이하 '서비스')의 이용과 관련하여 캠핑장과 이용자 간의 권리, 의무 및 책임사항을 규정함을 목적으로 합니다."}
                        </p>

                        <div className="space-y-8 text-sm leading-relaxed">
                            {/* Section 1 */}
                            <section className="space-y-2">
                                <h3 className="font-bold text-base text-[#1C4526] border-l-3 border-[#1C4526] pl-2.5">
                                    제1조 (약관의 효력 및 변경)
                                </h3>
                                <p className="text-stone-600 text-xs">
                                    1. 본 약관은 서비스 화면에 게시하거나 기타의 방법으로 이용자에게 공시함으로써 효력이 발생합니다.
                                </p>
                                <p className="text-stone-600 text-xs">
                                    2. 캠핑장은 관련 법령을 위배하지 않는 범위에서 본 약관을 개정할 수 있으며, 변경된 약관은 적용일자 7일 전부터 서비스 내에 공지합니다.
                                </p>
                            </section>

                            {/* Section 2 */}
                            <section className="space-y-2">
                                <h3 className="font-bold text-base text-[#1C4526] border-l-3 border-[#1C4526] pl-2.5">
                                    제2조 (예약 신청 및 자동 취소 규정)
                                </h3>
                                <p className="text-stone-600 text-xs">
                                    1. 이용자는 서비스를 통해 실시간 예약을 신청할 수 있으며, 예약 완료 후 지정된 계좌로 이용요금을 입금하여야 합니다.
                                </p>
                                <div className="mt-2 bg-[#FFF9E6] p-4 rounded-xl border border-[#FBE8B5] text-xs text-amber-900 flex gap-2">
                                    <Clock className="w-5 h-5 flex-shrink-0 text-amber-700 mt-0.5" />
                                    <div>
                                        <p className="font-bold mb-1">예약 확정 및 자동 취소 시간</p>
                                        <p className="leading-relaxed">
                                            예약 신청 후 **앱 내부에서 고지된 시간 이내**에 입금이 확인되지 않을 경우, 사전 통보 없이 예약 대기 상태가 **자동 취소** 처리됩니다. 원활한 예약을 위해 입금 시간을 준수해 주시기 바랍니다.
                                        </p>
                                    </div>
                                </div>
                            </section>

                            {/* Section 3 */}
                            <section className="space-y-2">
                                <h3 className="font-bold text-base text-[#1C4526] border-l-3 border-[#1C4526] pl-2.5">
                                    제3조 (환불 규정 및 수수료)
                                </h3>
                                <p className="text-stone-600 text-xs">
                                    캠핑장 예약 취소 시 소정의 위약 수수료를 제외한 금액이 환불됩니다. 환불 기준은 다음과 같습니다.
                                </p>
                                <div className="mt-2 overflow-hidden border border-stone-200 rounded-lg text-xs">
                                    <table className="min-w-full divide-y divide-stone-200">
                                        <thead className="bg-stone-50 text-stone-700 font-bold">
                                            <tr>
                                                <th className="px-4 py-2 text-left">취소 일시 (입실일 기준)</th>
                                                <th className="px-4 py-2 text-right">환불율 (이용 금액 대비)</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-stone-200 text-stone-600">
                                            <tr>
                                                <td className="px-4 py-2">입실 7일 전까지</td>
                                                <td className="px-4 py-2 text-right text-green-700 font-semibold">100% 환불</td>
                                            </tr>
                                            <tr>
                                                <td className="px-4 py-2">입실 6일 전</td>
                                                <td className="px-4 py-2 text-right">90% 환불</td>
                                            </tr>
                                            <tr>
                                                <td className="px-4 py-2">입실 5일 전</td>
                                                <td className="px-4 py-2 text-right">50% 환불</td>
                                            </tr>
                                            <tr>
                                                <td className="px-4 py-2">입실 4일 전</td>
                                                <td className="px-4 py-2 text-right">40% 환불</td>
                                            </tr>
                                            <tr>
                                                <td className="px-4 py-2">입실 3일 전</td>
                                                <td className="px-4 py-2 text-right">30% 환불</td>
                                            </tr>
                                            <tr>
                                                <td className="px-4 py-2">입실 2일 전</td>
                                                <td className="px-4 py-2 text-right">20% 환불</td>
                                            </tr>
                                            <tr>
                                                <td className="px-4 py-2">입실 1일 전 및 입실 당일</td>
                                                <td className="px-4 py-2 text-right text-red-600 font-semibold">환불 불가</td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                            </section>

                            {/* Section 4 */}
                            <section className="space-y-2">
                                <h3 className="font-bold text-base text-[#1C4526] border-l-3 border-[#1C4526] pl-2.5">
                                    제4조 (캠핑장 이용 안전 수칙)
                                </h3>
                                <p className="text-stone-600 text-xs">
                                    이용자는 다른 캠퍼와 지역 사회의 안전을 위해 아래 수칙을 반드시 준수해야 합니다.
                                </p>
                                <ul className="list-disc pl-5 text-stone-600 text-xs space-y-1.5 mt-2">
                                    <li><strong>매너 타임:</strong> 오후 10시부터 익일 오전 7시까지는 매너 타임입니다. 소란행위나 고성방가는 엄격히 제한됩니다.</li>
                                    <li><strong>화재 예방:</strong> 지정된 화로대 이외의 장소에서의 개인 화기 사용 및 장작 연소는 금지됩니다. 취침 시 불씨를 완전히 소화해야 합니다.</li>
                                    <li><strong>반려동물 동반:</strong> 반려동물 동반 입실 시 항상 목줄을 착용하고 배설물 관리를 철저히 해야 합니다.</li>
                                    <li><strong>쓰레기 배출:</strong> 재활용품과 일반 쓰레기는 지정된 분리수거장에 분리배출하여 주시기 바랍니다.</li>
                                </ul>
                            </section>

                            {/* Section 5 */}
                            <section className="space-y-2">
                                <h3 className="font-bold text-base text-[#1C4526] border-l-3 border-[#1C4526] pl-2.5">
                                    제5조 (면책 조항)
                                </h3>
                                <p className="text-stone-600 text-xs">
                                    1. 캠핑장은 기상악화, 천재지변, 국가 비상사태 등 불가항력적인 사유로 서비스 제공이나 캠핑장 운영이 불가능한 경우 책임을 지지 않습니다. 단, 운영 불가능 시 예약 금액은 전액 환불합니다.
                                </p>
                                <p className="text-stone-600 text-xs">
                                    2. 캠핑장 내에서 발생한 이용자 본인의 부주의로 인한 안전사고, 분실 및 도난 사고에 대해서는 캠핑장에서 책임을 지지 않습니다.
                                </p>
                            </section>
                        </div>
                    </div>
                )}

                {/* TAB 2: 위치기반서비스 이용약관 */}
                {activeTab === 'lbs' && (
                    <div>
                        <div className="flex items-center gap-2 pb-4 mb-6 border-b border-stone-100">
                            <MapPin className="w-6 h-6 text-[#1C4526]" />
                            <h2 className="text-xl font-extrabold text-stone-900 tracking-tight">위치기반서비스 이용약관</h2>
                        </div>

                        <p className="text-xs text-stone-500 mb-8 leading-relaxed">
                            {"본 약관은 '라온아이(RAON.I)'(이하 '회사')가 제공하는 위치기반서비스(이하 '서비스')의 이용과 관련하여 회사와 개인위치정보주체 간의 권리, 의무 및 책임사항, 기타 필요한 사항을 규정함을 목적으로 합니다."}
                        </p>

                        <div className="space-y-8 text-sm leading-relaxed">
                            {/* Section 1 */}
                            <section className="space-y-2">
                                <h3 className="font-bold text-base text-[#1C4526] border-l-3 border-[#1C4526] pl-2.5">
                                    제1조 (목적)
                                </h3>
                                <p className="text-stone-600 text-xs">
                                    본 약관은 회사가 제공하는 위치기반서비스를 이용함에 있어 회사와 이용자의 권리·의무 및 책임사항을 규정함을 목적으로 합니다.
                                </p>
                            </section>

                            {/* Section 2 */}
                            <section className="space-y-2">
                                <h3 className="font-bold text-base text-[#1C4526] border-l-3 border-[#1C4526] pl-2.5">
                                    제2조 (약관 외 준칙)
                                </h3>
                                <p className="text-stone-600 text-xs">
                                    본 약관에 명시되지 않은 사항은 「위치정보의 보호 및 이용 등에 관한 법률」, 「개인정보 보호법」, 「정보통신망 이용촉진 및 정보보호 등에 관한 법률」 등 관계 법령과 회사의 서비스 이용약관 및 개인정보처리방침에 따릅니다.
                                </p>
                            </section>

                            {/* Section 3 */}
                            <section className="space-y-2">
                                <h3 className="font-bold text-base text-[#1C4526] border-l-3 border-[#1C4526] pl-2.5">
                                    제3조 (서비스의 내용 및 요금)
                                </h3>
                                <p className="text-stone-600 text-xs">
                                    1. 회사는 위치정보사업자(스마트폰 단말기 OS, 웹 브라우저 Geolocation 등)로부터 제공받은 개인위치정보를 이용하여 다음과 같은 서비스를 제공합니다:
                                </p>
                                <ul className="list-disc pl-5 text-stone-600 text-xs space-y-1 mt-1">
                                    <li>현재 위치 기반 주변 캠핑장, 명소, 맛집, 축제, 마트 등 편의/관광 시설 탐색 및 거리 정보 제공</li>
                                    <li>현재 위치를 출발지로 설정한 AI 맞춤형 여행 일정(스마트 플랜, 즉시 여행 계획) 생성 및 경로 안내</li>
                                    <li>현재 위치 기준의 실시간 기상/날씨 예보 정보 제공</li>
                                    <li>지도 상의 현재 내 위치 마커 표시</li>
                                </ul>
                                <p className="text-stone-600 text-xs mt-2">
                                    2. 회사가 제공하는 위치기반서비스는 **무료**입니다. 단, 무선 데이터 통신망 이용 시 발생하는 데이터 통화료는 이용자의 통신사 정책에 따라 이용자 본인이 부담합니다.
                                </p>
                            </section>

                            {/* Section 4 */}
                            <section className="space-y-2">
                                <h3 className="font-bold text-base text-[#1C4526] border-l-3 border-[#1C4526] pl-2.5">
                                    제4조 (개인위치정보의 수집·이용 및 파기)
                                </h3>
                                <p className="text-stone-600 text-xs">
                                    1. 회사는 이용자의 서비스 이용 시점에 스마트폰의 브라우저/단말기 API를 통하여 실시간 위치정보(위도, 경도)를 1회성으로 획득하여 실시간 추천 및 경로 연산에만 활용합니다.
                                </p>
                                <p className="text-stone-600 text-xs">
                                    2. 회사는 원칙적으로 이용자의 실시간 위치정보를 서버 데이터베이스에 영구 보관하지 않으며, 실시간 정보 제공 목적이 달성된 즉시 파기합니다.
                                </p>
                            </section>

                            {/* Section 5 */}
                            <section className="space-y-2">
                                <h3 className="font-bold text-base text-[#1C4526] border-l-3 border-[#1C4526] pl-2.5">
                                    제5조 (개인위치정보주체의 권리)
                                </h3>
                                <p className="text-stone-600 text-xs">
                                    1. 이용자는 언제든지 회사에 대하여 위치정보 수집·이용에 대한 동의의 전부 또는 일부를 철회할 수 있습니다.
                                </p>
                                <p className="text-stone-600 text-xs">
                                    2. 이용자는 언제든지 회사에 대하여 위치정보의 일시적인 이용 중단을 요구할 수 있습니다.
                                </p>
                                <p className="text-stone-600 text-xs">
                                    3. 이용자는 회사에 대하여 아래 자료에 대한 열람 또는 고지를 요구할 수 있고, 해당 자료에 오류가 있는 경우에는 그 정정을 요구할 수 있습니다:
                                </p>
                                <ul className="list-disc pl-5 text-stone-600 text-xs space-y-1 mt-1">
                                    <li>이용자에 대한 위치정보 수집·이용·제공사실 확인자료</li>
                                    <li>이용자의 개인위치정보가 법령에 따라 제3자에게 제공된 이유 및 내용</li>
                                </ul>
                                <p className="text-stone-600 text-xs mt-2">
                                    4. 이용자는 스마트폰의 환경설정(설정 &gt; 위치 권한)을 통해 언제든지 위치 권한을 직접 해제할 수 있습니다.
                                </p>
                            </section>

                            {/* Section 6 */}
                            <section className="space-y-2">
                                <h3 className="font-bold text-base text-[#1C4526] border-l-3 border-[#1C4526] pl-2.5">
                                    제6조 (위치정보 이용·제공사실 확인자료의 보유)
                                </h3>
                                <p className="text-stone-600 text-xs">
                                    회사는 「위치정보의 보호 및 이용 등에 관한 법률」 제16조 제2항에 따라 고객의 위치정보 이용·제공사실 확인자료를 자동으로 기록·보존하며, 해당 자료는 6개월간 보관합니다. 단, 실시간 1회성 조회 후 서버에 저장하지 않는 위치정보의 경우 별도의 확인자료를 생성·보관하지 않습니다.
                                </p>
                            </section>

                            {/* Section 7 */}
                            <section className="space-y-2">
                                <h3 className="font-bold text-base text-[#1C4526] border-l-3 border-[#1C4526] pl-2.5">
                                    제7조 (손해배상 및 분쟁조정)
                                </h3>
                                <p className="text-stone-600 text-xs">
                                    1. 회사가 위치정보법 제15조부터 제26조까지의 규정을 위반하여 이용자에게 손해가 발생한 경우, 회사는 고의 또는 과실이 없음을 입증하지 아니하면 손해배상 책임을 집니다.
                                </p>
                                <p className="text-stone-600 text-xs">
                                    2. 위치정보와 관련된 분쟁에 대해 당사자 간 협의가 이루어지지 아니하거나 협의를 할 수 없는 경우, 「위치정보의 보호 및 이용 등에 관한 법률」 제28조에 따라 방송통신위원회에 재정을 신청하거나 「개인정보 보호법」 제43조에 따라 개인정보분쟁조정위원회에 조정을 신청할 수 있습니다.
                                </p>
                            </section>

                            {/* Section 8 */}
                            <section className="space-y-2">
                                <h3 className="font-bold text-base text-[#1C4526] border-l-3 border-[#1C4526] pl-2.5">
                                    제8조 (사업자 정보 및 위치정보 관리책임자)
                                </h3>
                                <p className="text-stone-600 text-xs">
                                    회사는 위치정보를 적절히 보호·관리하고 개인위치정보주체의 불만을 원활히 처리하기 위하여 다음과 같이 위치정보 관리책임자를 지정하여 운영합니다.
                                </p>
                                <div className="mt-2 bg-stone-50 p-3.5 rounded-xl border border-stone-200/80 text-xs text-stone-700 space-y-1.5">
                                    <p className="flex items-center gap-1.5">
                                        <ShieldCheck size={14} className="text-[#1C4526]" />
                                        <span><strong>상호명:</strong> 라온아이 (RAON.I)</span>
                                    </p>
                                    <p className="flex items-center gap-1.5">
                                        <User size={14} className="text-[#1C4526]" />
                                        <span><strong>위치정보 관리책임자:</strong> 정현석</span>
                                    </p>
                                    <p className="flex items-center gap-1.5">
                                        <Mail size={14} className="text-[#1C4526]" />
                                        <span><strong>연락처 및 이메일:</strong> tootg@naver.com</span>
                                    </p>
                                    <p className="text-stone-400 text-[11px] pt-1 border-t border-stone-200 mt-2">
                                        본 약관은 2026년 9월 14일부터 적용됩니다.
                                    </p>
                                </div>
                            </section>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}

export default function TermsPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen bg-[#F7F5EF] flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#1C4526]"></div>
            </div>
        }>
            <TermsContent />
        </Suspense>
    );
}
