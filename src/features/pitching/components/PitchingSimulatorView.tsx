'use client';

import React, { useState, useMemo, useEffect, useRef, Suspense } from 'react';
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
  CloudRain,
  Camera,
  Calendar,
  Cloud,
  CloudLightning,
  CloudFog,
  Flame,
  ChevronRight,
  Eye,
} from 'lucide-react';
import type {
  SiteGeometry,
  UserGear,
  StayDuration,
  WeatherCaseCode,
} from '../types';
import { SITE_1_GEOMETRY, DEFAULT_TUNNEL_TENT } from '../constants/defaultSite';
import { calculatePitchingScoring } from '../engine/pitchScoringEngine';
import { calculateWeatherLighting, getWindLevel } from '../engine/weatherLightingEngine';
import PitchingCanvas from './3d/PitchingCanvas';

interface PitchingSimulatorViewProps {
  initialSite?: SiteGeometry;
  initialGear?: UserGear;
}

// 12대 날씨 케이스 목록 라벨 및 아이콘 매핑
const WEATHER_PRESETS: { code: WeatherCaseCode; label: string; icon: string }[] = [
  { code: 'clear', label: '쾌청 맑음', icon: '☀️' },
  { code: 'partly_cloudy', label: '구름많음', icon: '⛅' },
  { code: 'overcast', label: '흐림', icon: '☁️' },
  { code: 'drizzle', label: '이슬비', icon: '🌦️' },
  { code: 'rain', label: '보통 비', icon: '🌧️' },
  { code: 'heavy_rain', label: '호우/폭우', icon: '⛈️' },
  { code: 'shower', label: '소나기', icon: '🌦️' },
  { code: 'sleet', label: '진눈깨비', icon: '🌨️' },
  { code: 'snow', label: '함박눈', icon: '❄️' },
  { code: 'fog', label: '짙은 안개', icon: '🌫️' },
  { code: 'yellow_dust', label: '황사/먼지', icon: '😷' },
  { code: 'thunderstorm', label: '뇌우/낙뢰', icon: '⚡' },
];

export default function PitchingSimulatorView({
  initialSite = SITE_1_GEOMETRY,
  initialGear = DEFAULT_TUNNEL_TENT,
}: PitchingSimulatorViewProps) {
  const [site] = useState<SiteGeometry>(initialSite);
  const [gear] = useState<UserGear>(initialGear);
  const [activeTab, setActiveTab] = useState<'3D' | 'CARD'>('3D');

  // 1. 일정 관리: 1박2일(15초), 2박3일(30초), 3박4일(45초)
  const [duration, setDuration] = useState<StayDuration>('1N2D');

  // 총 시간 계산: 1박=22시간(14시~익일12시), 2박=46시간, 3박=70시간
  const totalHours = useMemo(() => {
    if (duration === '1N2D') return 22;
    if (duration === '2N3D') return 46;
    return 70;
  }, [duration]);

  // 목표 타임랩스 재생 시간 (초 단위)
  const targetPlaybackSeconds = useMemo(() => {
    if (duration === '1N2D') return 15;
    if (duration === '2N3D') return 30;
    return 45;
  }, [duration]);

  // 타임라인 경과 시간 (0.0 ~ totalHours)
  const [elapsedHours, setElapsedHours] = useState<number>(1.0); // 초기값: 1일차 15:00 (14:00 + 1.0)
  const [tentRotationDeg, setTentRotationDeg] = useState<number>(initialSite.bearingDeg || 135);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);

  // 날씨 및 환경 조작
  const [weatherCase, setWeatherCase] = useState<WeatherCaseCode>('clear');
  const [windSpeed, setWindSpeed] = useState<number>(2.5); // m/s
  const [isCapturing, setIsCapturing] = useState<boolean>(false);

  // 현재 시점의 절대 시간(입실 14시 기준 누적 시간)
  const absoluteHour = 14 + elapsedHours;
  const currentDay = Math.floor(absoluteHour / 24) + 1;
  const currentHourInDay = absoluteHour % 24;

  // 2. 12대 날씨 매트릭스 3D 렌더링 파라미터 실시간 연산
  const weatherLighting = useMemo(() => {
    return calculateWeatherLighting({
      hour: currentHourInDay,
      dayIndex: currentDay,
      weatherCase,
      windSpeed,
      horizonProfile: site.horizonProfile,
    });
  }, [currentHourInDay, currentDay, weatherCase, windSpeed, site.horizonProfile]);

  // 3. 순수 기하 24방향 채점 엔진
  const scoringResult = useMemo(() => {
    return calculatePitchingScoring(site, gear);
  }, [site, gear]);

  const reinforcedPegPositions = useMemo(() => {
    return scoringResult.reinforcedPegs.map((p) => p.position);
  }, [scoringResult]);

  // 4. N박 N일 비례 타임랩스 재생 타이머 엔진 (1박 15초, 2박 30초, 3박 45초)
  useEffect(() => {
    if (!isPlaying) return;

    // 100ms마다 진행할 시간 분량: totalHours / (targetPlaybackSeconds * 10)
    const hoursPerTick = totalHours / (targetPlaybackSeconds * 10);

    const interval = setInterval(() => {
      setElapsedHours((prev) => {
        const next = prev + hoursPerTick;
        if (next >= totalHours) {
          setIsPlaying(false);
          return totalHours;
        }
        return Math.round(next * 100) / 100;
      });
    }, 100);

    return () => clearInterval(interval);
  }, [isPlaying, totalHours, targetPlaybackSeconds]);

  // 5. 핵심 모먼트 숏컷 이동 핸들러
  const jumpToMoment = (day: number, hour: number) => {
    setIsPlaying(false);
    // 1일차 14:00 기준 경과 시간 계산
    const targetAbsolute = (day - 1) * 24 + hour;
    const targetElapsed = Math.max(0, Math.min(totalHours, targetAbsolute - 14));
    setElapsedHours(targetElapsed);
  };

  // 6. 3D 캔버스 이미지 스크린샷 캡처 및 다운로드 기능 (WBS 5)
  const handleCaptureSnapshot = () => {
    try {
      setIsCapturing(true);
      const canvasEl = document.querySelector('canvas');
      if (!canvasEl) {
        alert('3D 캔버스를 찾을 수 없습니다.');
        setIsCapturing(false);
        return;
      }
      const dataUrl = canvasEl.toDataURL('image/png');
      const link = document.createElement('a');
      link.download = `raon_pitching_${site.name}_${weatherLighting.timeStr.replace(':', '')}.png`;
      link.href = dataUrl;
      link.click();
      setTimeout(() => setIsCapturing(false), 500);
    } catch (err) {
      console.error('캡처 오류:', err);
      setIsCapturing(false);
    }
  };

  return (
    <div className="flex flex-col h-screen w-full bg-[#141C16] text-stone-100 overflow-hidden select-none">
      {/* 1. 상단 미니 헤더 */}
      <header className="flex items-center justify-between px-4 py-2.5 bg-[#1C3B29] border-b border-[#2A553C] shrink-0 z-20 shadow-md">
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 rounded-full bg-emerald-600/30 flex items-center justify-center border border-emerald-400/40">
            <Tent className="w-4 h-4 text-emerald-300" />
          </div>
          <div>
            <h1 className="text-sm font-bold tracking-tight text-white flex items-center gap-1.5">
              <span>가상 피칭 & 날씨 시뮬레이터</span>
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-emerald-800 text-emerald-200 border border-emerald-500/30">
                P0 프로토타입
              </span>
            </h1>
            <p className="text-[11px] text-emerald-200/80">
              {site.name} ({site.widthM}m × {site.depthM}m) · {gear.modelName}
            </p>
          </div>
        </div>

        {/* 상단 우측: 캡처 버튼 & 탭 전환 버튼 */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleCaptureSnapshot}
            disabled={isCapturing}
            className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg bg-[#254F37] hover:bg-[#2E6345] text-stone-200 border border-emerald-500/30 shadow-sm active:scale-95 transition-all"
            title="3D 피칭 가이드 이미지 저장"
          >
            <Camera className="w-3.5 h-3.5 text-emerald-300" />
            <span className="hidden sm:inline">이미지 저장</span>
          </button>

          <div className="flex bg-[#12271B] p-0.5 rounded-lg border border-emerald-600/30">
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
        </div>
      </header>

      {/* 2. 메인 시뮬레이션 영역 (3D 뷰 or 결과 카드) */}
      <div className="relative flex-1 w-full bg-[#18231C] overflow-hidden flex items-center justify-center">
        {activeTab === '3D' ? (
          <Suspense fallback={<SimulationLoadingState />}>
            {/* 3D 디오라마 캔버스 */}
            <PitchingCanvas
              site={site}
              gear={gear}
              simHour={currentHourInDay}
              dayIndex={currentDay}
              weatherCase={weatherCase}
              windSpeed={windSpeed}
              tentRotationDeg={tentRotationDeg}
              reinforcedPegPositions={reinforcedPegPositions}
              weatherParams={weatherLighting}
            />

            {/* 좌상단 오버레이: 현재 시점 날씨 & 시간 배지 */}
            <div className="absolute top-3 left-3 bg-[#13271C]/90 backdrop-blur-md px-3.5 py-2.5 rounded-2xl border border-emerald-500/35 shadow-xl text-xs space-y-1 z-10 max-w-[260px]">
              <div className="flex items-center justify-between gap-3">
                <span className="font-bold text-white flex items-center gap-1.5 text-sm">
                  <span>{currentDay}일차</span>
                  <span className="text-amber-300">{weatherLighting.timeStr}</span>
                </span>
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-900/80 text-emerald-200 border border-emerald-500/30 font-medium">
                  {WEATHER_PRESETS.find((w) => w.code === weatherCase)?.icon}{' '}
                  {WEATHER_PRESETS.find((w) => w.code === weatherCase)?.label}
                </span>
              </div>

              <div className="flex items-center gap-2 text-[11px] text-stone-300 pt-0.5">
                <span>풍속 {windSpeed}m/s</span>
                <span>·</span>
                <span className="text-emerald-300 font-semibold">피칭 {scoringResult.score}점</span>
                {weatherLighting.isOccludedByRidge && (
                  <span className="text-amber-300 font-bold">· 산그늘</span>
                )}
              </div>

              {/* 기상 및 안전 경고 문구 */}
              {weatherLighting.warningMessage && (
                <div className="pt-1 border-t border-emerald-600/30 text-[10.5px] text-amber-200 flex items-start gap-1 leading-tight">
                  <AlertCircle className="w-3 h-3 text-amber-400 shrink-0 mt-0.5" />
                  <span>{weatherLighting.warningMessage}</span>
                </div>
              )}
            </div>

            {/* 우상단 오버레이: 12대 날씨 케이스 빠른 변경 바 (드롭다운/스크롤) */}
            <div className="absolute top-3 right-3 flex flex-col items-end gap-1.5 z-10">
              <div className="bg-[#13271C]/92 backdrop-blur-md p-1.5 rounded-xl border border-emerald-500/35 shadow-lg flex items-center gap-1 overflow-x-auto max-w-[320px] scrollbar-none">
                {WEATHER_PRESETS.map((wp) => (
                  <button
                    key={wp.code}
                    type="button"
                    onClick={() => setWeatherCase(wp.code)}
                    className={`px-2 py-1 text-[11px] font-semibold rounded-lg shrink-0 transition-all ${
                      weatherCase === wp.code
                        ? 'bg-emerald-600 text-white shadow-sm scale-105'
                        : 'bg-[#1D3A29] text-stone-300 hover:text-white hover:bg-[#254A34]'
                    }`}
                    title={wp.label}
                  >
                    <span>{wp.icon}</span>
                    <span className="ml-1 hidden md:inline">{wp.label}</span>
                  </button>
                ))}
              </div>

              {/* 핵심 모먼트 숏컷 버튼 묶음 */}
              <div className="flex flex-wrap justify-end gap-1 max-w-[280px]">
                <button
                  type="button"
                  onClick={() => jumpToMoment(1, 14)}
                  className="px-2 py-0.5 text-[10px] font-bold rounded bg-[#1D3A29]/90 text-stone-200 border border-emerald-600/30 hover:bg-emerald-700"
                >
                  14:00 피칭
                </button>
                <button
                  type="button"
                  onClick={() => jumpToMoment(1, 15)}
                  className="px-2 py-0.5 text-[10px] font-bold rounded bg-amber-600/90 text-white border border-amber-400/40 hover:bg-amber-500"
                >
                  15:00 그늘
                </button>
                <button
                  type="button"
                  onClick={() => jumpToMoment(1, 17)}
                  className="px-2 py-0.5 text-[10px] font-bold rounded bg-amber-700/90 text-white border border-amber-500/40 hover:bg-amber-600"
                >
                  17:00 산그늘
                </button>
                <button
                  type="button"
                  onClick={() => jumpToMoment(1, 18.5)}
                  className="px-2 py-0.5 text-[10px] font-bold rounded bg-orange-700/90 text-white border border-orange-400/40 hover:bg-orange-600"
                >
                  18:30 노을
                </button>
                <button
                  type="button"
                  onClick={() => jumpToMoment(1, 21)}
                  className="px-2 py-0.5 text-[10px] font-bold rounded bg-indigo-900/90 text-indigo-100 border border-indigo-400/40 hover:bg-indigo-800"
                >
                  21:00 랜턴
                </button>
                <button
                  type="button"
                  onClick={() => jumpToMoment(2, 6.5)}
                  className="px-2 py-0.5 text-[10px] font-bold rounded bg-amber-800/90 text-amber-100 border border-amber-400/40 hover:bg-amber-700"
                >
                  06:30 일출
                </button>
                <button
                  type="button"
                  onClick={() => jumpToMoment(2, 12)}
                  className="px-2 py-0.5 text-[10px] font-bold rounded bg-emerald-800/90 text-white border border-emerald-400/40 hover:bg-emerald-700"
                >
                  12:00 철수
                </button>
              </div>
            </div>

            {/* 하단 플로팅 컨트롤러: 타임라인 슬라이더 & 텐트 회전 */}
            <div className="absolute bottom-4 left-3 right-3 bg-[#1C3B29]/95 backdrop-blur-md p-3.5 rounded-2xl border border-emerald-500/40 shadow-2xl max-w-lg mx-auto space-y-3 z-10">
              {/* 1) 일정 선택 탭 (1박 15초 / 2박 30초 / 3박 45초) */}
              <div className="flex items-center justify-between pb-2 border-b border-emerald-600/30">
                <div className="flex items-center gap-1.5 text-xs text-stone-200">
                  <Calendar className="w-3.5 h-3.5 text-emerald-300" />
                  <span className="font-semibold">일정 선택:</span>
                </div>
                <div className="flex bg-[#12271B] p-0.5 rounded-lg border border-emerald-600/30">
                  {(['1N2D', '2N3D', '3N4D'] as StayDuration[]).map((dur) => (
                    <button
                      key={dur}
                      type="button"
                      onClick={() => {
                        setDuration(dur);
                        setElapsedHours(1.0);
                        setIsPlaying(false);
                      }}
                      className={`px-2 py-0.5 text-[11px] font-bold rounded-md transition-all ${
                        duration === dur
                          ? 'bg-[#2E7D47] text-white shadow-sm'
                          : 'text-stone-300 hover:text-white'
                      }`}
                    >
                      {dur === '1N2D' ? '1박2일 (15초)' : dur === '2N3D' ? '2박3일 (30초)' : '3박4일 (45초)'}
                    </button>
                  ))}
                </div>
              </div>

              {/* 2) 타임랩스 재생 및 24시간 타임라인 슬라이더 */}
              <div>
                <div className="flex items-center justify-between text-xs font-semibold mb-1.5">
                  <div className="flex items-center gap-1.5 text-amber-300">
                    <Sun className="w-3.5 h-3.5" />
                    <span>
                      {currentDay}일차 {weatherLighting.timeStr}
                    </span>
                    <span className="text-[10px] text-stone-300 font-normal">
                      ({weatherLighting.isTentLanternOn ? '야간 랜턴 모드' : weatherLighting.isOccludedByRidge ? '산그늘' : '주간 햇살'})
                    </span>
                  </div>

                  {/* 타임랩스 재생/일시정지 */}
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setIsPlaying(!isPlaying)}
                      className="flex items-center gap-1 px-2.5 py-0.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold shadow-sm active:scale-95 transition-all"
                    >
                      {isPlaying ? (
                        <>
                          <Pause className="w-3 h-3" />
                          <span>일시정지</span>
                        </>
                      ) : (
                        <>
                          <Play className="w-3 h-3 fill-white" />
                          <span>{targetPlaybackSeconds}초 재생</span>
                        </>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsPlaying(false);
                        setElapsedHours(0);
                      }}
                      className="p-1 rounded bg-[#12271B] text-stone-300 hover:text-white border border-emerald-600/30"
                      title="입실 시각(14:00)으로 리셋"
                    >
                      <RotateCcw className="w-3 h-3" />
                    </button>
                  </div>
                </div>

                {/* 슬라이더 트랙 */}
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-stone-400">1일차 14시</span>
                  <input
                    type="range"
                    min="0"
                    max={totalHours}
                    step="0.1"
                    value={elapsedHours}
                    onChange={(e) => {
                      setIsPlaying(false);
                      setElapsedHours(Number(e.target.value));
                    }}
                    className="flex-1 accent-emerald-400 cursor-pointer h-2 bg-[#0E1F15] rounded-lg"
                  />
                  <span className="text-[10px] text-stone-400">퇴실 12시</span>
                </div>
              </div>

              {/* 3) 텐트 각도 조작 바 */}
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
                    className="px-2 py-0.5 text-[11px] font-bold rounded-md bg-[#12271B] text-stone-200 hover:text-white border border-emerald-600/30 active:scale-95"
                  >
                    ↺ -15°
                  </button>
                  <button
                    type="button"
                    onClick={() => setTentRotationDeg(scoringResult.recommendedBearingDeg)}
                    className="px-2.5 py-0.5 text-[11px] font-bold rounded-md bg-[#2E7D47] text-white hover:bg-emerald-600 border border-emerald-500/40 active:scale-95"
                  >
                    추천 {scoringResult.recommendedBearingDeg}°
                  </button>
                  <button
                    type="button"
                    onClick={() => setTentRotationDeg((prev) => (prev + 15) % 360)}
                    className="px-2 py-0.5 text-[11px] font-bold rounded-md bg-[#12271B] text-stone-200 hover:text-white border border-emerald-600/30 active:scale-95"
                  >
                    +15° ↻
                  </button>
                </div>
              </div>
            </div>
          </Suspense>
        ) : (
          /* 3. 1탭 결과 요약 카드 (WBS 4·5 통합 완성형) */
          <div className="p-4 w-full max-w-md mx-auto overflow-y-auto max-h-full space-y-3.5 pb-8">
            {/* 상단 액션 바: 이미지 다운로드 */}
            <div className="flex items-center justify-between bg-[#1C3B29] p-3 rounded-2xl border border-emerald-500/30">
              <div>
                <p className="text-xs font-bold text-white">가상 피칭 분석 리포트</p>
                <p className="text-[11px] text-stone-300">
                  {duration === '1N2D' ? '1박 2일 일정' : duration === '2N3D' ? '2박 3일 일정' : '3박 4일 일정'} · {site.name}
                </p>
              </div>
              <button
                type="button"
                onClick={handleCaptureSnapshot}
                className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md transition-all active:scale-95"
              >
                <Camera className="w-3.5 h-3.5" />
                <span>가이드 저장</span>
              </button>
            </div>

            {/* 최적 피칭 추천 방향 */}
            <div className="bg-[#1C3B29] p-4 rounded-2xl border border-emerald-500/40 shadow-xl">
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
            <div className="bg-[#1C3B29] p-4 rounded-2xl border border-amber-500/40 shadow-xl">
              <h4 className="text-sm font-bold text-amber-300 mb-2 flex items-center gap-1.5">
                <ShieldAlert className="w-4 h-4" />
                <span>주풍향 보강 팩 (3D 노란 링 표시)</span>
              </h4>
              <div className="space-y-2">
                {scoringResult.reinforcedPegs.map((peg, idx) => (
                  <div key={idx} className="bg-[#12271B] p-2.5 rounded-xl border border-emerald-600/20 text-xs text-stone-200">
                    <p className="font-semibold text-emerald-300 mb-0.5">보강 포인트 #{idx + 1}</p>
                    <p className="text-[11px] leading-relaxed text-stone-300">{peg.reason}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* 시간대별 주의사항 타임라인 */}
            <div className="bg-[#1C3B29] p-4 rounded-2xl border border-emerald-500/30 shadow-xl">
              <h4 className="text-sm font-bold text-white mb-2 flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4 text-cyan-300" />
                <span>시간대별 주의사항 타임라인</span>
              </h4>
              <div className="space-y-1.5">
                {scoringResult.warningTimeRanges.map((w, idx) => (
                  <div key={idx} className="flex items-start gap-2 text-xs bg-[#12271B] p-2 rounded-xl border border-emerald-600/20">
                    <span className="font-bold text-cyan-300 shrink-0 text-[11px]">{w.timeStr}</span>
                    <span className="text-stone-300 text-[11px]">{w.message}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* 준비물 체크리스트 */}
            <div className="bg-[#1C3B29] p-4 rounded-2xl border border-emerald-500/30 shadow-xl">
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
