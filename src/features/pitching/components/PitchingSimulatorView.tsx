'use client';

import React, { useState, Suspense } from 'react';
import { Tent, Sun, Wind, Compass, Sparkles, AlertCircle, RefreshCw } from 'lucide-react';
import type { SiteGeometry, UserGear } from '../types';
import { SITE_1_GEOMETRY, DEFAULT_TUNNEL_TENT } from '../constants/defaultSite';

interface PitchingSimulatorViewProps {
  initialSite?: SiteGeometry;
  initialGear?: UserGear;
}

export default function PitchingSimulatorView({
  initialSite = SITE_1_GEOMETRY,
  initialGear = DEFAULT_TUNNEL_TENT,
}: PitchingSimulatorViewProps) {
  const [site] = useState<SiteGeometry>(initialSite);
  const [gear] = useState<UserGear>(initialGear);
  const [activeTab, setActiveTab] = useState<'3D' | 'CARD'>('3D');
  const [simHour, setSimHour] = useState<number>(15); // 기본 오후 3시 (검증 기준 시각)
  const [isSimulating] = useState<boolean>(false);

  return (
    <div className="flex flex-col h-screen w-full bg-[#18231C] text-stone-100 overflow-hidden select-none">
      {/* 1. 상단 미니 헤더 (캠프웜 포레스트 테마) */}
      <header className="flex items-center justify-between px-4 py-3 bg-[#224732] border-b border-[#2e5d42] shrink-0 z-20 shadow-md">
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 rounded-full bg-emerald-600/30 flex items-center justify-center border border-emerald-400/40">
            <Tent className="w-4 h-4 text-emerald-300" />
          </div>
          <div>
            <h1 className="text-sm font-bold tracking-tight text-white flex items-center gap-1.5">
              <span>가상 피칭 & 날씨 시뮬레이터</span>
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-emerald-800 text-emerald-200 border border-emerald-500/30">
                P0 프리뷰
              </span>
            </h1>
            <p className="text-[11px] text-emerald-200/80">
              {site.name} · {gear.modelName}
            </p>
          </div>
        </div>

        {/* 탭 전환 버튼 */}
        <div className="flex bg-[#163022] p-0.5 rounded-lg border border-emerald-600/30">
          <button
            type="button"
            onClick={() => setActiveTab('3D')}
            className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all ${
              activeTab === '3D'
                ? 'bg-[#2E7D47] text-white shadow-sm'
                : 'text-stone-300 hover:text-white'
            }`}
          >
            3D 뷰
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('CARD')}
            className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all ${
              activeTab === 'CARD'
                ? 'bg-[#2E7D47] text-white shadow-sm'
                : 'text-stone-300 hover:text-white'
            }`}
          >
            결과 카드
          </button>
        </div>
      </header>

      {/* 2. 메인 시뮬레이션 영역 (3D 뷰) */}
      <div className="relative flex-1 w-full bg-[#1b2b20] overflow-hidden flex items-center justify-center">
        {activeTab === '3D' ? (
          <Suspense fallback={<SimulationLoadingState />}>
            {/* 3D 캔버스 영역 스켈레톤 (WBS 3에서 R3F Canvas 직결) */}
            <div className="relative w-full h-full flex flex-col items-center justify-center">
              {/* 임시 안내 오버레이 (WBS 1 검증용) */}
              <div className="text-center p-6 max-w-sm mx-auto bg-[#224732]/85 backdrop-blur-md rounded-2xl border border-emerald-500/30 shadow-2xl">
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 text-emerald-300 mx-auto flex items-center justify-center mb-3">
                  <Sparkles className="w-6 h-6 animate-pulse" />
                </div>
                <h3 className="text-base font-bold text-white mb-1">
                  P0 시뮬레이터 보안 세션 활성화
                </h3>
                <p className="text-xs text-stone-300 leading-relaxed mb-4">
                  대표님 계정(<span className="text-emerald-300 font-semibold">tootg</span>) 인증이 안전하게 완료되었습니다.
                  <br />
                  다음 WBS 2단계(지형 능선 고도각) 및 WBS 3단계(3D 디오라마 렌더러)가 이 공간에 연결됩니다.
                </p>

                <div className="bg-[#183123] rounded-xl p-3 text-left space-y-1.5 border border-emerald-600/20 text-[11px]">
                  <div className="flex justify-between text-stone-300">
                    <span>대상 사이트:</span>
                    <span className="font-semibold text-white">{site.name} ({site.widthM}m × {site.depthM}m)</span>
                  </div>
                  <div className="flex justify-between text-stone-300">
                    <span>장비 규격:</span>
                    <span className="font-semibold text-white">터널형 ({gear.lengthM}m × {gear.widthM}m)</span>
                  </div>
                  <div className="flex justify-between text-stone-300">
                    <span>검증 시간대:</span>
                    <span className="font-semibold text-amber-300">{simHour}:00 (오후 일사·그늘)</span>
                  </div>
                  <div className="flex justify-between text-stone-300 pt-1 border-t border-emerald-600/30">
                    <span>지형 데이터 (국토정보):</span>
                    <span className="font-semibold text-emerald-300">6개월 유효 (2026.10 동기화)</span>
                  </div>
                </div>
              </div>

              {/* 하단 플로팅 타임랩스 컨트롤러 (WBS 4 연동 예정) */}
              <div className="absolute bottom-6 left-4 right-4 bg-[#224732]/90 backdrop-blur-md p-3.5 rounded-2xl border border-emerald-500/30 shadow-xl max-w-md mx-auto">
                <div className="flex items-center justify-between text-xs font-semibold mb-2">
                  <span className="flex items-center gap-1.5 text-amber-300">
                    <Sun className="w-4 h-4" />
                    <span>시간별 태양 & 바람</span>
                  </span>
                  <span className="px-2 py-0.5 rounded bg-emerald-900/80 text-emerald-200 text-[11px] font-bold">
                    {simHour}:00 ({simHour === 15 ? '오후 검증 #1' : simHour === 17 ? '오후 검증 #2' : '일반'})
                  </span>
                </div>

                <div className="flex items-center gap-3">
                  <span className="text-[11px] text-stone-400">10:00</span>
                  <input
                    type="range"
                    min="10"
                    max="18"
                    step="1"
                    value={simHour}
                    onChange={(e) => setSimHour(Number(e.target.value))}
                    className="flex-1 accent-emerald-500 cursor-pointer h-2 bg-emerald-950 rounded-lg"
                  />
                  <span className="text-[11px] text-stone-400">18:00</span>
                </div>

                <div className="flex justify-between mt-2 pt-2 border-t border-emerald-600/20 text-[11px] text-stone-300">
                  <div className="flex items-center gap-1">
                    <Wind className="w-3.5 h-3.5 text-cyan-300" />
                    <span>예보 풍향: 남서풍 2.8m/s</span>
                  </div>
                  <div className="flex items-center gap-1 text-emerald-300">
                    <Compass className="w-3.5 h-3.5" />
                    <span>추천 방향: 135° (남동향)</span>
                  </div>
                </div>
              </div>
            </div>
          </Suspense>
        ) : (
          /* 결과 카드 탭 (WBS 5 연동 예정) */
          <div className="p-4 w-full max-w-md mx-auto overflow-y-auto max-h-full space-y-3">
            <div className="bg-[#224732] p-4 rounded-2xl border border-emerald-500/30">
              <h4 className="text-sm font-bold text-white mb-2 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-emerald-300" />
                <span>추천 피칭 방향: 남동향 (135°)</span>
              </h4>
              <p className="text-xs text-stone-200 leading-relaxed">
                오후 15시 이후 서쪽 산 능선 그늘을 뒤편으로 두고, 정오의 강한 햇빛이 거실 공간에 들이치지 않도록 배치하는 것이 가장 쾌적합니다.
              </p>
            </div>

            <div className="bg-[#224732] p-4 rounded-2xl border border-emerald-500/30">
              <h4 className="text-sm font-bold text-white mb-2 flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4 text-amber-300" />
                <span>바람 대비 보강 팩 위치</span>
              </h4>
              <p className="text-xs text-stone-200 leading-relaxed">
                오후 14시~16시 사이 남서쪽 계곡 골바람(최대 4.5m/s)이 예상되므로, 텐트 좌측 후면 가이라인 팩을 40cm 장팩으로 단단히 보강하세요.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function SimulationLoadingState() {
  return (
    <div className="flex flex-col items-center justify-center p-8 space-y-3">
      <RefreshCw className="w-8 h-8 text-emerald-400 animate-spin" />
      <p className="text-xs text-stone-300">3D 시뮬레이션 환경 로딩 중...</p>
    </div>
  );
}
