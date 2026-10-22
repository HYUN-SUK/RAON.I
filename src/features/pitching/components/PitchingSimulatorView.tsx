'use client';

import React, { useState, useMemo, useEffect, Suspense } from 'react';
import {
  Tent,
  Sun,
  Wind,
  Compass,
  Sparkles,
  AlertCircle,
  RefreshCw,
  Play,
  Pause,
  RotateCcw,
  CheckCircle2,
  ShieldAlert,
} from 'lucide-react';
import type { SiteGeometry, UserGear } from '../types';
import { SITE_1_GEOMETRY, DEFAULT_TUNNEL_TENT } from '../constants/defaultSite';
import { calculatePitchingScoring } from '../engine/pitchScoringEngine';
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
  const [isPlaying, setIsPlaying] = useState<boolean>(false);

  // 1. 순수 기하 벡터 기반 24방향 Scoring 채점 연산 (0.01초 만에 산출)
  const scoringResult = useMemo(() => {
    return calculatePitchingScoring(site, gear);
  }, [site, gear]);

  // 보강 팩 3D 좌표 목록
  const reinforcedPegPositions = useMemo(() => {
    return scoringResult.reinforcedPegs.map((p) => p.position);
  }, [scoringResult]);

  // 2. 30초 타임랩스 재생 타이머 엔진 (10시 ~ 18시 연속 재생)
  useEffect(() => {
    if (!isPlaying) return;

    const interval = setInterval(() => {
      setSimHour((prev) => {
        if (prev >= 18) {
          setIsPlaying(false);
          return 18;
        }
        return Math.round((prev + 0.1) * 10) / 10;
      });
    }, 120); // 120ms마다 6분(0.1시간)씩 부드럽게 전진 -> 총 10초 내외 타임랩스

    return () => clearInterval(interval);
  }, [isPlaying]);

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

      {/* 2. 메인 시뮬레이션 영역 (3D 뷰 or 결과 카드) */}
      <div className="relative flex-1 w-full bg-[#1b2b20] overflow-hidden flex items-center justify-center">
        {activeTab === '3D' ? (
          <Suspense fallback={<SimulationLoadingState />}>
            {/* 3D 디오라마 캔버스 */}
            <PitchingCanvas
              site={site}
              gear={gear}
              simHour={simHour}
              tentRotationDeg={tentRotationDeg}
              reinforcedPegPositions={reinforcedPegPositions}
            />

            {/* 상단 좌측 미니 오버레이 배지 (사이트 정보 & 종합 점수) */}
            <div className="absolute top-3 left-3 bg-[#183123]/88 backdrop-blur-md px-3 py-2 rounded-xl border border-emerald-500/30 shadow-lg text-[11px] space-y-0.5 pointer-events-none">
              <div className="flex items-center gap-1.5 text-white font-bold">
                <Sparkles className="w-3.5 h-3.5 text-emerald-300" />
                <span>{site.name} ({site.widthM}m × {site.depthM}m)</span>
              </div>
              <div className="flex items-center gap-2 text-[10px]">
                <span className="text-emerald-300 font-semibold">피칭 적합도: {scoringResult.score}점</span>
                <span className="text-stone-400">·</span>
                <span className="text-stone-300">국토정보 표고 연동</span>
              </div>
            </div>

            {/* 상단 우측 빠른 검증 버튼 (15시 / 17시 그늘 검증 숏컷) */}
            <div className="absolute top-3 right-3 flex flex-col gap-1.5 z-10">
              <button
                type="button"
                onClick={() => {
                  setIsPlaying(false);
                  setSimHour(15);
                }}
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
                onClick={() => {
                  setIsPlaying(false);
                  setSimHour(17);
                }}
                className={`px-2.5 py-1 text-[11px] font-bold rounded-lg border shadow-sm transition-all ${
                  simHour === 17
                    ? 'bg-amber-500 text-stone-950 border-amber-300 scale-105'
                    : 'bg-[#224732]/90 text-stone-200 border-emerald-600/40 hover:bg-[#2e5d42]'
                }`}
              >
                17:00 산그늘 검증
              </button>
            </div>

            {/* 하단 플로팅 타임랩스 & 텐트 조작 바 */}
            <div className="absolute bottom-5 left-3 right-3 bg-[#224732]/94 backdrop-blur-md p-3.5 rounded-2xl border border-emerald-500/35 shadow-2xl max-w-md mx-auto space-y-3 z-10">
              {/* 태양 타임라인 조작 & 타임랩스 재생 버튼 */}
              <div>
                <div className="flex items-center justify-between text-xs font-semibold mb-1.5">
                  <div className="flex items-center gap-1.5 text-amber-300">
                    <Sun className="w-3.5 h-3.5" />
                    <span>태양 이동 & 그늘</span>
                    <span className="text-[10px] text-stone-300 font-normal">
                      ({simHour >= 17 ? '서쪽 산그늘 진입' : simHour >= 15 ? '오후 직사광' : '한낮'})
                    </span>
                  </div>

                  {/* 타임랩스 재생 / 일시정지 컨트롤러 */}
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setIsPlaying(!isPlaying)}
                      className="flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-700 hover:bg-emerald-600 text-white text-[11px] font-bold shadow-sm active:scale-95 transition-all"
                    >
                      {isPlaying ? (
                        <>
                          <Pause className="w-3 h-3" />
                          <span>일시정지</span>
                        </>
                      ) : (
                        <>
                          <Play className="w-3 h-3 fill-white" />
                          <span>타임랩스 재생</span>
                        </>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsPlaying(false);
                        setSimHour(10);
                      }}
                      className="p-1 rounded bg-[#183123] text-stone-300 hover:text-white border border-emerald-600/30"
                      title="10시로 리셋"
                    >
                      <RotateCcw className="w-3 h-3" />
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-stone-400">10시</span>
                  <input
                    type="range"
                    min="10"
                    max="18"
                    step="0.1"
                    value={simHour}
                    onChange={(e) => {
                      setIsPlaying(false);
                      setSimHour(Number(e.target.value));
                    }}
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
                  {tentRotationDeg === scoringResult.recommendedBearingDeg && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-800 text-emerald-200 font-bold border border-emerald-500/30">
                      최적 추천
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
                    onClick={() => setTentRotationDeg(scoringResult.recommendedBearingDeg)}
                    className="px-2 py-1 text-[11px] font-bold rounded-md bg-[#2E7D47] text-white hover:bg-emerald-600 border border-emerald-500/40 active:scale-95"
                  >
                    추천 {scoringResult.recommendedBearingDeg}°
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
          /* 3. 1탭 결과 요약 카드 (WBS 4·5 연동) */
          <div className="p-4 w-full max-w-md mx-auto overflow-y-auto max-h-full space-y-3 pb-8">
            {/* 최적 피칭 추천 방향 */}
            <div className="bg-[#224732] p-4 rounded-2xl border border-emerald-500/40 shadow-xl">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-bold text-white flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-emerald-300" />
                  <span>추천 피칭 방향: 남동향 ({scoringResult.recommendedBearingDeg}°)</span>
                </h4>
                <span className="px-2 py-0.5 rounded-full bg-emerald-900 text-emerald-200 font-bold text-xs border border-emerald-500/30">
                  {scoringResult.score}점
                </span>
              </div>
              <p className="text-xs text-stone-200 leading-relaxed">
                오후 13~16시 강한 서쪽 햇빛이 텐트 거실로 직접 들어오는 것을 차단하고,
                서남서 골바람을 텐트 좁은 후면으로 흘려보내 측면 돌풍 저항을 최소화하는 최적의 각도입니다.
              </p>
            </div>

            {/* 바람 대비 보강 팩 안내 */}
            <div className="bg-[#224732] p-4 rounded-2xl border border-amber-500/40 shadow-xl">
              <h4 className="text-sm font-bold text-amber-300 mb-2 flex items-center gap-1.5">
                <ShieldAlert className="w-4 h-4" />
                <span>주풍향 보강 팩 (3D 노란 링 표시)</span>
              </h4>
              <div className="space-y-2">
                {scoringResult.reinforcedPegs.map((peg, idx) => (
                  <div key={idx} className="bg-[#183123] p-2.5 rounded-xl border border-emerald-600/20 text-xs text-stone-200">
                    <p className="font-semibold text-emerald-300 mb-0.5">보강 포인트 #{idx + 1}</p>
                    <p className="text-[11px] leading-relaxed text-stone-300">{peg.reason}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* 시간대별 주의사항 타임라인 */}
            <div className="bg-[#224732] p-4 rounded-2xl border border-emerald-500/30 shadow-xl">
              <h4 className="text-sm font-bold text-white mb-2 flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4 text-cyan-300" />
                <span>시간대별 주의사항 타임라인</span>
              </h4>
              <div className="space-y-1.5">
                {scoringResult.warningTimeRanges.map((w, idx) => (
                  <div key={idx} className="flex items-start gap-2 text-xs bg-[#183123] p-2 rounded-xl border border-emerald-600/20">
                    <span className="font-bold text-cyan-300 shrink-0 text-[11px]">{w.timeStr}</span>
                    <span className="text-stone-300 text-[11px]">{w.message}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* 준비물 체크리스트 */}
            <div className="bg-[#224732] p-4 rounded-2xl border border-emerald-500/30 shadow-xl">
              <h4 className="text-sm font-bold text-white mb-2 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-300" />
                <span>현장 피칭 체크리스트</span>
              </h4>
              <ul className="space-y-1.5 text-xs text-stone-200">
                {scoringResult.checklist.map((item, idx) => (
                  <li key={idx} className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
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
