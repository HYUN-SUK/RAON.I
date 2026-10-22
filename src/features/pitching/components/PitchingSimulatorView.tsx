'use client';

import React, { useState, Suspense } from 'react';
import { Tent, Sun, Wind, Compass, Sparkles, AlertCircle, RefreshCw } from 'lucide-react';
import type { SiteGeometry, UserGear } from '../types';
import { SITE_1_GEOMETRY, DEFAULT_TUNNEL_TENT } from '../constants/defaultSite';
import PitchingCanvas from './3d/PitchingCanvas';

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
  const [tentRotationDeg, setTentRotationDeg] = useState<number>(initialSite.bearingDeg || 135);
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
            {/* 1. 실제 Three.js 3D 디오라마 캔버스 */}
            <PitchingCanvas
              site={site}
              gear={gear}
              simHour={simHour}
              tentRotationDeg={tentRotationDeg}
            />

            {/* 2. 상단 좌측 미니 오버레이 배지 (사이트 정보 & 6개월 동기화) */}
            <div className="absolute top-3 left-3 bg-[#183123]/85 backdrop-blur-md px-3 py-2 rounded-xl border border-emerald-500/30 shadow-lg text-[11px] space-y-0.5 pointer-events-none">
              <div className="flex items-center gap-1.5 text-white font-bold">
                <Sparkles className="w-3.5 h-3.5 text-emerald-300" />
                <span>{site.name} ({site.widthM}m × {site.depthM}m)</span>
              </div>
              <div className="text-stone-300 text-[10px]">
                국토지리정보원 표고 · 6개월 유효
              </div>
            </div>

            {/* 3. 상단 우측 빠른 검증 버튼 (15시 / 17시 그늘 검증 숏컷) */}
            <div className="absolute top-3 right-3 flex flex-col gap-1.5 z-10">
              <button
                type="button"
                onClick={() => setSimHour(15)}
                className={`px-2.5 py-1 text-[11px] font-bold rounded-lg border shadow-sm transition-all ${
                  simHour === 15
                    ? 'bg-amber-500 text-stone-950 border-amber-300 scale-105'
                    : 'bg-[#224732]/90 text-stone-200 border-emerald-600/40 hover:bg-[#2e5d42]'
                }`}
              >
                15:00 그늘 검증
              </button>
              <button
                type="button"
                onClick={() => setSimHour(17)}
                className={`px-2.5 py-1 text-[11px] font-bold rounded-lg border shadow-sm transition-all ${
                  simHour === 17
                    ? 'bg-amber-500 text-stone-950 border-amber-300 scale-105'
                    : 'bg-[#224732]/90 text-stone-200 border-emerald-600/40 hover:bg-[#2e5d42]'
                }`}
              >
                17:00 산그늘 검증
              </button>
            </div>

            {/* 4. 하단 플로팅 듀얼 컨트롤러 (태양 시간 슬라이더 + 텐트 회전 컨트롤러) */}
            <div className="absolute bottom-5 left-3 right-3 bg-[#224732]/92 backdrop-blur-md p-3.5 rounded-2xl border border-emerald-500/35 shadow-2xl max-w-md mx-auto space-y-3 z-10">
              {/* 태양 타임라인 조작 */}
              <div>
                <div className="flex items-center justify-between text-xs font-semibold mb-1.5">
                  <span className="flex items-center gap-1 text-amber-300">
                    <Sun className="w-3.5 h-3.5" />
                    <span>태양 이동 & 그늘</span>
                  </span>
                  <span className="px-2 py-0.5 rounded bg-emerald-900/90 text-emerald-200 text-[11px] font-bold">
                    {simHour}:00 ({simHour >= 17 ? '서쪽 산그늘' : simHour >= 15 ? '오후 일사' : '한낮'})
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-stone-400">10시</span>
                  <input
                    type="range"
                    min="10"
                    max="18"
                    step="0.5"
                    value={simHour}
                    onChange={(e) => setSimHour(Number(e.target.value))}
                    className="flex-1 accent-emerald-400 cursor-pointer h-2 bg-emerald-950 rounded-lg"
                  />
                  <span className="text-[10px] text-stone-400">18시</span>
                </div>
              </div>

              {/* 텐트 피칭 방향(회전) 조작 */}
              <div className="pt-2 border-t border-emerald-600/25 flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs text-stone-200">
                  <Compass className="w-3.5 h-3.5 text-emerald-300" />
                  <span>텐트 방향:</span>
                  <span className="font-bold text-emerald-300">{Math.round(tentRotationDeg)}°</span>
                  {tentRotationDeg === 135 && (
                    <span className="text-[10px] px-1 py-0.2 rounded bg-emerald-700 text-white font-semibold">
                      추천
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setTentRotationDeg((prev) => (prev - 15 + 360) % 360)}
                    className="px-2 py-1 text-[11px] font-bold rounded-md bg-[#183123] text-stone-200 hover:text-white border border-emerald-600/30 active:scale-95"
                  >
                    ↺ -15°
                  </button>
                  <button
                    type="button"
                    onClick={() => setTentRotationDeg(135)}
                    className="px-2 py-1 text-[11px] font-bold rounded-md bg-[#2E7D47] text-white hover:bg-emerald-600 border border-emerald-500/40 active:scale-95"
                  >
                    남동(135°)
                  </button>
                  <button
                    type="button"
                    onClick={() => setTentRotationDeg((prev) => (prev + 15) % 360)}
                    className="px-2 py-1 text-[11px] font-bold rounded-md bg-[#183123] text-stone-200 hover:text-white border border-emerald-600/30 active:scale-95"
                  >
                    +15° ↻
                  </button>
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
