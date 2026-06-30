'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ShieldCheck, Mail, User } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function PrivacyPolicyPage() {
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
                    <h1 className="text-lg font-bold">개인정보처리방침</h1>
                </div>
            </header>

            {/* Content Container */}
            <main className="max-w-lg mx-auto px-5 py-8 bg-white min-h-[calc(100vh-64px)] shadow-sm border-x border-stone-100">
                <div className="flex items-center gap-2 pb-4 mb-6 border-b border-stone-100">
                    <ShieldCheck className="w-6 h-6 text-[#1C4526]" />
                    <h2 className="text-xl font-extrabold text-stone-900 tracking-tight">개인정보 처리방침</h2>
                </div>

                <p className="text-xs text-stone-500 mb-8 leading-relaxed">
                    {"'라온아이(RAON.I)'(이하 '서비스')는 「개인정보 보호법」 제30조에 따라 정보주체의 개인정보를 보호하고 이와 관련한 고충을 신속하고 원활하게 처리할 수 있도록 하기 위하여 다음과 같이 개인정보 처리방침을 수립·공개합니다."}
                </p>

                <div className="space-y-8 text-sm leading-relaxed">
                    {/* Section 1 */}
                    <section className="space-y-2">
                        <h3 className="font-bold text-base text-[#1C4526] border-l-3 border-[#1C4526] pl-2.5">
                            제1조 (개인정보의 처리 목적)
                        </h3>
                        <p className="text-stone-600 text-xs">
                            서비스는 다음의 목적을 위하여 개인정보를 처리합니다. 처리하고 있는 개인정보는 다음의 목적 이외의 용도로는 이용되지 않으며, 이용 목적이 변경되는 경우에는 「개인정보 보호법」 제18조에 따라 별도의 동의를 받는 등 필요한 조치를 이행할 예정입니다.
                        </p>
                        <ul className="list-disc pl-5 text-stone-600 text-xs space-y-1 mt-2">
                            <li><strong>회원 가입 및 관리:</strong> 소셜 로그인 연동을 통한 본인 식별 및 회원자격 유지·관리, 서비스 부정이용 방지.</li>
                            <li><strong>예약 서비스 제공:</strong> 캠핑장 예약 신청 및 등록, 대기 예약 관리, 요금 결제 확인, 연박 할인 및 환불 처리.</li>
                            <li><strong>알림 서비스:</strong> 예약 확정/취소 안내, 입실 리마인더 및 빈자리 알림 발송(FCM 푸시 알림).</li>
                        </ul>
                    </section>

                    {/* Section 2 */}
                    <section className="space-y-2">
                        <h3 className="font-bold text-base text-[#1C4526] border-l-3 border-[#1C4526] pl-2.5">
                            제2조 (처리하는 개인정보의 항목)
                        </h3>
                        <p className="text-stone-600 text-xs">
                            서비스는 회원 가입 및 원활한 예약 서비스 제공을 위해 아래와 같은 개인정보 항목을 수집하고 있습니다.
                        </p>
                        <div className="mt-2 bg-stone-50 p-3 rounded-xl border border-stone-100 text-xs text-stone-600 space-y-1.5">
                            <p>1. <strong>수집 항목 (소셜 로그인 연동):</strong> 닉네임, 프로필 이미지, 이메일 주소, 고유 식별자 ID.</p>
                            <p>2. <strong>예약 신청 시 수집 항목:</strong> 예약자명, 연락처(휴대폰 번호), 예약 정보(숙박 일자, 사이트 번호, 방문 인원수, 차량 번호, 추가 요청사항).</p>
                            <p>3. <strong>서비스 이용 과정에서 자동 생성되어 수집될 수 있는 항목:</strong> IP주소, 쿠키, 서비스 이용 기록, 접속 로그, 디바이스 토큰(FCM 푸시용).</p>
                        </div>
                    </section>

                    {/* Section 3 */}
                    <section className="space-y-2">
                        <h3 className="font-bold text-base text-[#1C4526] border-l-3 border-[#1C4526] pl-2.5">
                            제3조 (개인정보의 처리 및 보유 기간)
                        </h3>
                        <p className="text-stone-600 text-xs">
                            1. 서비스는 법령에 따른 개인정보 보유·이용기간 또는 정보주체로부터 개인정보를 수집 시에 동의받은 개인정보 보유·이용기간 내에서 개인정보를 처리·보유합니다.
                        </p>
                        <p className="text-stone-600 text-xs">
                            2. 이용자의 개인정보는 <strong>회원 탈퇴 시 지체 없이 파기</strong>됩니다. 다만, 다음의 관계 법령 규정에 의하여 보존할 필요가 있는 경우 해당 기간 동안 보관합니다:
                        </p>
                        <ul className="list-disc pl-5 text-stone-600 text-xs space-y-1 mt-1">
                            <li>계약 또는 청약철회 등에 관한 기록: 5년 (전자상거래법)</li>
                            <li>대금결제 및 재화 등의 공급에 관한 기록: 5년 (전자상거래법)</li>
                            <li>소비자의 불만 또는 분쟁처리에 관한 기록: 3년 (전자상거래법)</li>
                        </ul>
                    </section>

                    {/* Section 4 */}
                    <section className="space-y-2">
                        <h3 className="font-bold text-base text-[#1C4526] border-l-3 border-[#1C4526] pl-2.5">
                            제4조 (개인정보의 위탁 및 국외 이전)
                        </h3>
                        <p className="text-stone-600 text-xs">
                            1. 서비스는 원활한 개인정보 업무처리를 위하여 다음과 같이 개인정보 처리 업무를 위탁하고 있습니다.
                        </p>
                        <p className="text-stone-600 text-xs">
                            2. 본 서비스는 클라우드 기반 인프라를 사용함에 따라 관련 법령에 의거하여 다음과 같이 개인정보 위탁 및 국외 이전을 고지합니다:
                        </p>
                        
                        <div className="mt-3 space-y-3">
                            <div className="bg-stone-50 p-3.5 rounded-xl border border-stone-100 text-xs">
                                <h4 className="font-bold text-stone-800 mb-1">수탁업체: Supabase Inc.</h4>
                                <p className="text-stone-500">이전 국가: 미국 (US)</p>
                                <p className="text-stone-500">이전 항목: 회원 가입 정보, 예약 정보 일체</p>
                                <p className="text-stone-500">방법: 보안 네트워크를 통한 데이터 암호화 전송 및 데이터베이스 보관</p>
                                <p className="text-stone-500">보유기간: 회원 탈퇴 시 또는 위탁 계약 종료 시까지</p>
                            </div>
                            
                            <div className="bg-stone-50 p-3.5 rounded-xl border border-stone-100 text-xs">
                                <h4 className="font-bold text-stone-800 mb-1">수탁업체: Google LLC (Firebase)</h4>
                                <p className="text-stone-500">이전 국가: 미국 (US)</p>
                                <p className="text-stone-500">이전 항목: 디바이스 토큰 (FCM 푸시용)</p>
                                <p className="text-stone-500">방법: 알림 발송 요청 시 보안 API 통신 전송</p>
                                <p className="text-stone-500">보유기간: 앱 삭제 또는 푸시 알림 수신 거부 시까지</p>
                            </div>
                        </div>
                    </section>

                    {/* Section 5 */}
                    <section className="space-y-2">
                        <h3 className="font-bold text-base text-[#1C4526] border-l-3 border-[#1C4526] pl-2.5">
                            제5조 (정보주체의 권리·의무 및 그 행사방법)
                        </h3>
                        <p className="text-stone-600 text-xs">
                            1. 정보주체는 서비스에 대해 언제든지 개인정보 열람·정정·삭제·처리정지 요구 등의 권리를 행사할 수 있습니다.
                        </p>
                        <p className="text-stone-600 text-xs">
                            {"2. 권리 행사는 앱 내의 '내 공간 ➡️ 회원 탈퇴' 메뉴를 통해 즉시 진행하시거나, 개인정보 보호책임자에게 이메일로 요청하시면 지체 없이 조치하겠습니다."}
                        </p>
                    </section>

                    {/* Section 6 */}
                    <section className="space-y-2">
                        <h3 className="font-bold text-base text-[#1C4526] border-l-3 border-[#1C4526] pl-2.5">
                            제6조 (개인정보의 파기절차 및 방법)
                        </h3>
                        <p className="text-stone-600 text-xs">
                            1. 서비스는 개인정보 보유기간의 경과, 처리목적 달성 등 개인정보가 불필요하게 되었을 때에는 지체 없이 해당 개인정보를 파기합니다.
                        </p>
                        <p className="text-stone-600 text-xs">
                            2. 파기방법: 전자적 파일 형태의 정보는 기록을 재생할 수 없는 기술적 방법(영구 삭제)을 사용하여 파기합니다.
                        </p>
                    </section>

                    {/* Section 7 */}
                    <section className="space-y-2">
                        <h3 className="font-bold text-base text-[#1C4526] border-l-3 border-[#1C4526] pl-2.5">
                            제7조 (개인정보의 안전성 확보 조치)
                        </h3>
                        <p className="text-stone-600 text-xs">
                            서비스는 개인정보의 안전성 확보를 위해 다음과 같은 조치를 취하고 있습니다.
                        </p>
                        <ul className="list-disc pl-5 text-stone-600 text-xs space-y-1 mt-1">
                            <li><strong>기술적 조치:</strong> 개인정보 데이터베이스 암호화, 개인정보 전송 시 보안 프로토콜(HTTPS/SSL) 적용.</li>
                            <li><strong>관리적 조치:</strong> 접근 권한 제한 및 정기적인 자가 점검.</li>
                        </ul>
                    </section>

                    {/* Section 8 */}
                    <section className="space-y-2">
                        <h3 className="font-bold text-base text-[#1C4526] border-l-3 border-[#1C4526] pl-2.5">
                            제8조 (개인정보 자동 수집 장치의 설치·운영 및 거부)
                        </h3>
                        <p className="text-stone-600 text-xs">
                            1. 서비스는 이용자에게 개별적인 맞춤서비스를 제공하기 위해 이용정보를 저장하고 수시로 불러오는 ‘쿠키(cookie)’를 사용합니다.
                        </p>
                        <p className="text-stone-600 text-xs">
                            2. 이용자는 브라우저 또는 모바일 기기 옵션 설정을 통해 쿠키 저장을 거부할 수 있으나, 거부할 경우 자동 로그인 등 일부 기능 제한이 있을 수 있습니다.
                        </p>
                    </section>

                    {/* Section 9 */}
                    <section className="space-y-3">
                        <h3 className="font-bold text-base text-[#1C4526] border-l-3 border-[#1C4526] pl-2.5">
                            제9조 (개인정보 보호책임자)
                        </h3>
                        <p className="text-stone-600 text-xs">
                            서비스는 개인정보 처리에 관한 업무를 총괄해서 책임지고, 관련 정보주체의 불만처리 및 피해구제를 위하여 아래와 같이 보호책임자를 지정하고 있습니다.
                        </p>
                        
                        <div className="bg-[#F7F5EF] p-4 rounded-xl border border-stone-200 mt-2 space-y-2">
                            <div className="flex items-center gap-2 text-stone-700">
                                <User className="w-4 h-4 text-[#1C4526]" />
                                <span className="font-bold text-xs">보호책임자: 정현석 (라온아이 대표)</span>
                            </div>
                            <div className="flex items-center gap-2 text-stone-600">
                                <Mail className="w-4 h-4 text-stone-500" />
                                <span className="text-xs">이메일: a01074040108@gmail.com</span>
                            </div>
                        </div>
                    </section>

                    {/* Section 10 */}
                    <section className="space-y-2 pt-4 border-t border-stone-100">
                        <h3 className="font-bold text-base text-stone-800">
                            제10조 (개인정보 처리방침의 변경)
                        </h3>
                        <p className="text-stone-500 text-xs">
                            이 개인정보 처리방침은 2026년 6월 29일부터 적용됩니다.
                        </p>
                    </section>
                </div>
            </main>
        </div>
    );
}
