'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, FileText, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function TermsPage() {
    const router = useRouter();

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
            <main className="max-w-lg mx-auto px-5 py-8 bg-white min-h-[calc(100vh-64px)] shadow-sm border-x border-stone-100">
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
            </main>
        </div>
    );
}
