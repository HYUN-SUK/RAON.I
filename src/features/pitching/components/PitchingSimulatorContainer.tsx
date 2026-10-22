'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import type { SiteGeometry, UserGear } from '../types';

interface PitchingSimulatorContainerProps {
  initialSite?: SiteGeometry;
  initialGear?: UserGear;
}

// 3D 뷰 컴포넌트를 SSR 제외하고 클라이언트에서만 지연 로딩
const PitchingSimulatorView = dynamic(
  () => import('./PitchingSimulatorView'),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-screen w-full items-center justify-center bg-[#18231C] text-emerald-300">
        <div className="text-center space-y-3">
          <div className="w-9 h-9 mx-auto border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs font-semibold text-emerald-200">
            3D 시뮬레이터 보안 세션 로딩 중...
          </p>
          <p className="text-[11px] text-stone-400">
            태양 궤적 및 기상청 예보 엔진을 동기화하고 있습니다.
          </p>
        </div>
      </div>
    ),
  }
);

export default function PitchingSimulatorContainer(props: PitchingSimulatorContainerProps) {
  return <PitchingSimulatorView {...props} />;
}
