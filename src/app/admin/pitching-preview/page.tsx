import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase-server';
import { isAuthorizedPitchingUser } from '@/features/pitching/guards/pitchingAuthGuard';
import PitchingSimulatorContainer from '@/features/pitching/components/PitchingSimulatorContainer';

export const metadata: Metadata = {
  title: '가상 피칭 & 날씨 시뮬레이터 (P0)',
  robots: {
    index: false,
    follow: false,
  },
};

export default async function PitchingPreviewPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // 1. 보안 인가 검증: 관리자 또는 대표님 계정(tootg)이 아니면 즉시 404 차단
  const isAuthorized = isAuthorizedPitchingUser(
    user?.email,
    user?.app_metadata?.role || user?.user_metadata?.role
  );

  if (!isAuthorized) {
    // 비인가자에게는 페이지 존재 자체를 은폐 (404 Page Not Found)
    notFound();
  }

  return (
    <div className="-m-4 md:-m-8 h-[calc(100dvh-57px)] md:h-[calc(100vh-57px)] w-auto overflow-hidden">
      <PitchingSimulatorContainer />
    </div>
  );
}
