'use client';

import React, { useState, useMemo, useEffect, Suspense } from 'react';
import {
  Tent,
  Sun,
  Compass,
  Sparkles,
  AlertCircle,
  RefreshCw,
  Play,
  Pause,
  RotateCcw,
  CheckCircle2,
  ShieldAlert,
  Camera,
  Calendar,
  Layers,
  ChevronDown,
  SlidersHorizontal,
  Flame,
} from 'lucide-react';
import type {
  SiteGeometry,
  UserGear,
  StayDuration,
  WeatherCaseCode,
  PlacedGearItem,
  SimulationStep,
} from '../types';
import { SITE_1_GEOMETRY, DEFAULT_TUNNEL_TENT } from '../constants/defaultSite';
import { calculatePitchingScoring } from '../engine/pitchScoringEngine';
import { calculateWeatherLighting } from '../engine/weatherLightingEngine';
import PitchingCanvas from './3d/PitchingCanvas';
import PitchingEntryModal, { PitchingEntrySelection } from './wizard/PitchingEntryModal';
import SitePlacementEditor from './wizard/SitePlacementEditor';

interface PitchingSimulatorViewProps {
  initialSite?: SiteGeometry;
  initialGear?: UserGear;
}

// 12대 날씨 케이스 목록 라벨 및 아이콘
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
  // 현재 위자드 단계 (기본값: 진입 모달 즉시 표출)
  const [step, setStep] = useState<SimulationStep>('ENTRY');
  const [isEntryModalOpen, setIsEntryModalOpen] = useState<boolean>(true);

  // 사이트 및 복수 장비 상태
  const [site, setSite] = useState<SiteGeometry>({
    ...initialSite,
    locationType: 'campground',
    campgroundName: '라온아이 캠핑장',
    siteName: '철수네 (Site 1)',
    widthM: initialSite.widthM || 8,
    depthM: initialSite.depthM || 7,
  });

  // 복수 배치 장비 목록 (기본 터널형 텐트 1동 장착)
  const [placedGears, setPlacedGears] = useState<PlacedGearItem[]>([
    {
      id: 'initial_tent_1',
      type: 'tunnel_tent',
      name: '표준 터널형 텐트',
      lengthM: initialGear.lengthM || 6.2,
      widthM: initialGear.widthM || 3.3,
      heightM: initialGear.heightM || 2.1,
      color: initialGear.color || '#4B5320',
      x: 0,
      z: 0,
      rotationDeg: initialSite.bearingDeg || 135,
    },
  ]);

  const [activeTab, setActiveTab] = useState<'3D' | 'CARD'>('3D');
  const [isDetailPanelOpen, setIsDetailPanelOpen] = useState<boolean>(false);

  // 일정 및 시간 관리
  const [duration, setDuration] = useState<StayDuration>('1N2D');
  const [season, setSeason] = useState<'summer' | 'autumn' | 'winter' | 'spring'>('summer');

  const simDate = useMemo(() => {
    switch (season) {
      case 'summer': return new Date('2026-07-20T12:00:00'); // 여름 19:30 밝음
      case 'winter': return new Date('2026-12-22T12:00:00'); // 겨울 17:30 밤
      case 'spring': return new Date('2026-05-15T12:00:00');
      case 'autumn':
      default: return new Date('2026-10-22T12:00:00');
    }
  }, [season]);

  const totalHours = useMemo(() => (duration === '1N2D' ? 22 : duration === '2N3D' ? 46 : 70), [duration]);
  const targetPlaybackSeconds = useMemo(() => (duration === '1N2D' ? 15 : duration === '2N3D' ? 30 : 45), [duration]);

  const [elapsedHours, setElapsedHours] = useState<number>(1.0); // 초기: 1일차 15:00
  const [isPlaying, setIsPlaying] = useState<boolean>(false);

  // 환경 및 기상
  const [weatherCase, setWeatherCase] = useState<WeatherCaseCode>('clear');
  const [windSpeed, setWindSpeed] = useState<number>(2.5);
  const [isCapturing, setIsCapturing] = useState<boolean>(false);

  // 현재 시각 계산
  const absoluteHour = 14 + elapsedHours;
  const currentDay = Math.floor(absoluteHour / 24) + 1;
  const currentHourInDay = absoluteHour % 24;

  // 12대 날씨 매트릭스 및 천문 고도각 계산 (태양 고도 3181도 버그 방지)
  const weatherLighting = useMemo(() => {
    return calculateWeatherLighting({
      hour: currentHourInDay,
      dayIndex: currentDay,
      date: simDate,
      lat: site.lat,
      lng: site.lng,
      weatherCase,
      windSpeed,
      horizonProfile: site.horizonProfile,
    });
  }, [currentHourInDay, currentDay, simDate, site.lat, site.lng, weatherCase, windSpeed, site.horizonProfile]);

  // 24방향 Scoring 채점
  const scoringResult = useMemo(() => {
    const representativeGear: UserGear = {
      shape: 'tunnel',
      lengthM: placedGears[0]?.lengthM || 6.2,
      widthM: placedGears[0]?.widthM || 3.3,
      heightM: placedGears[0]?.heightM || 2.1,
      color: placedGears[0]?.color || '#4B5320',
      doorSides: ['front'],
    };
    return calculatePitchingScoring(site, representativeGear);
  }, [site, placedGears]);

  const reinforcedPegPositions = useMemo(() => {
    return scoringResult.reinforcedPegs.map((p) => p.position);
  }, [scoringResult]);

  // N박 비례 타임랩스 타이머
  useEffect(() => {
    if (!isPlaying) return;

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

  // 모먼트 숏컷 이동
  const jumpToMoment = (day: number, hour: number) => {
    setIsPlaying(false);
    const targetAbsolute = (day - 1) * 24 + hour;
    const targetElapsed = Math.max(0, Math.min(totalHours, targetAbsolute - 14));
    setElapsedHours(targetElapsed);
  };

  // 진입 모달 선택 완료 핸들러
  const handleEntrySelect = (sel: PitchingEntrySelection) => {
    setIsEntryModalOpen(false);
    setSite({
      ...site,
      locationType: sel.locationType,
      name: sel.name,
      campgroundName: sel.campgroundName,
      siteName: sel.siteName,
      address: sel.address,
      lat: sel.lat,
      lng: sel.lng,
      widthM: sel.widthM || 8,
      depthM: sel.depthM || 7,
    });
    // 선택 후 2D 배치 에디터(Step 2)로 이동
    setStep('GEAR_SETUP');
  };

  // 3D 스크린샷 캡처 다운로드 (WBS 5)
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

  // 상단 장비 요약 문자열 생성
  const gearsSummaryText = useMemo(() => {
    if (placedGears.length === 0) return '장비 미배치';
    return placedGears
      .map((g) => {
        const typeName = g.type.includes('tarp') ? '타프' : '텐트';
        return `${typeName} (${g.lengthM}×${g.widthM}m)`;
      })
      .join(' + ');
  }, [placedGears]);

  // Step 1: 첫 진입 2-Track 모달 렌더링
  if (step === 'ENTRY') {
    return (
      <div className="relative h-screen w-full bg-[#121E15] flex items-center justify-center">
        <PitchingEntryModal
          isOpen={isEntryModalOpen}
          onClose={() => {
            // 닫았을 때 기본 샘플로 Step 2로 이동
            setIsEntryModalOpen(false);
            setStep('GEAR_SETUP');
          }}
          onSelect={handleEntrySelect}
        />
      </div>
    );
  }

  // Step 2: 2D 배치 에디터 렌더링
  if (step === 'GEAR_SETUP') {
    return (
      <SitePlacementEditor
        site={site}
        onUpdateSite={setSite}
        placedGears={placedGears}
        onUpdateGears={setPlacedGears}
        onStartSimulation={() => setStep('SIMULATION_3D')}
        onBackToEntry={() => {
          setIsEntryModalOpen(true);
          setStep('ENTRY');
        }}
      />
    );
  }

  // Step 3: 3D 감성 시뮬레이션 렌더링
  return (
    <div className="flex flex-col h-screen w-full bg-[#121E15] text-stone-100 overflow-hidden select-none">
      {/* 1. 상단 미니멀 헤더 (캠핑장/노지 주소 + 장비 요약 규격화) */}
      <header className="flex items-center justify-between px-4 py-2.5 bg-[#1C3B29] border-b border-[#2A553C] shrink-0 z-20 shadow-md">
        <div className="flex items-center space-x-2.5">
          <button
            type="button"
            onClick={() => {
              setIsEntryModalOpen(true);
              setStep('ENTRY');
            }}
            className="w-8 h-8 rounded-full bg-emerald-600/30 flex items-center justify-center border border-emerald-400/40 hover:bg-emerald-600/50 transition-colors"
            title="장소 및 일정 변경"
          >
            <Tent className="w-4 h-4 text-emerald-300" />
          </button>
          <div>
            <h1 className="text-xs sm:text-sm font-bold tracking-tight text-white flex items-center gap-1.5 leading-tight">
              <span>
                {site.locationType === 'campground'
                  ? `🏕️ ${site.campgroundName || '라온아이'} · ${site.siteName || site.name}`
                  : `📍 ${site.address || site.name}`} ({site.widthM}m × {site.depthM}m)
              </span>
            </h1>
            <p className="text-[10.5px] text-emerald-200/80 font-mono">
              {gearsSummaryText}
            </p>
          </div>
        </div>

        {/* 헤더 우측: 2D 배치 수정 버튼, 캡처, 탭 */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setStep('GEAR_SETUP')}
            className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg bg-[#254F37] hover:bg-[#2E6345] text-stone-200 border border-emerald-500/30 shadow-sm active:scale-95 transition-all"
            title="텐트 및 타프 배치 수정"
          >
            <Layers className="w-3.5 h-3.5 text-emerald-300" />
            <span className="hidden sm:inline">배치 수정</span>
          </button>

          <button
            type="button"
            onClick={handleCaptureSnapshot}
            disabled={isCapturing}
            className="p-1.5 sm:px-2.5 sm:py-1 text-xs font-semibold rounded-lg bg-[#254F37] hover:bg-[#2E6345] text-stone-200 border border-emerald-500/30 shadow-sm active:scale-95 transition-all"
            title="3D 피칭 가이드 이미지 저장"
          >
            <Camera className="w-3.5 h-3.5 text-emerald-300" />
            <span className="hidden sm:inline ml-1">저장</span>
          </button>

          <div className="flex bg-[#12271B] p-0.5 rounded-lg border border-emerald-600/30">
            <button
              type="button"
              onClick={() => setActiveTab('3D')}
              className={`px-2 py-0.5 text-xs font-semibold rounded-md transition-all ${
                activeTab === '3D' ? 'bg-[#2E7D47] text-white' : 'text-stone-300 hover:text-white'
              }`}
            >
              3D
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('CARD')}
              className={`px-2 py-0.5 text-xs font-semibold rounded-md transition-all ${
                activeTab === 'CARD' ? 'bg-[#2E7D47] text-white' : 'text-stone-300 hover:text-white'
              }`}
            >
              카드
            </button>
          </div>
        </div>
      </header>

      {/* 2. 메인 시뮬레이션 영역 */}
      <div className="relative flex-1 w-full bg-[#18231C] overflow-hidden flex items-center justify-center">
        {activeTab === '3D' ? (
          <Suspense fallback={<SimulationLoadingState />}>
            {/* 3D 디오라마 캔버스 */}
            <PitchingCanvas
              site={site}
              placedGears={placedGears}
              simHour={currentHourInDay}
              dayIndex={currentDay}
              weatherCase={weatherCase}
              windSpeed={windSpeed}
              reinforcedPegPositions={reinforcedPegPositions}
              weatherParams={weatherLighting}
            />

            {/* 좌상단: 깔끔한 1줄 천문 태양 고도 & 일출/일몰 배지 */}
            <div className="absolute top-3 left-3 bg-[#13271C]/90 backdrop-blur-md px-3 py-2 rounded-2xl border border-emerald-500/35 shadow-xl text-xs space-y-1 z-10 max-w-[280px]">
              <div className="flex items-center justify-between gap-2">
                <span className="font-bold text-white flex items-center gap-1.5 text-sm">
                  <span>{currentDay}일차</span>
                  <span className="text-amber-300 font-mono">{weatherLighting.timeStr}</span>
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-900/80 text-emerald-200 font-medium">
                  {weatherLighting.isBonfireActive
                    ? '🔥 야간 불멍 모드'
                    : weatherLighting.isOccludedByRidge
                    ? '⛰️ 산그늘'
                    : weatherLighting.altitudeDeg > 12
                    ? '☀️ 한낮 햇살'
                    : '🌅 노을'}
                </span>
              </div>
              <div className="flex items-center justify-between text-[10px] text-stone-300 pt-0.5 border-t border-emerald-600/30">
                <span className="text-amber-200">
                  고도 {weatherLighting.altitudeDeg}° (방위 {weatherLighting.azimuthDeg}°)
                </span>
                <span>🌅 {weatherLighting.sunriseStr} · 🌇 {weatherLighting.sunsetStr}</span>
              </div>
            </div>

            {/* 우상단: [상세 환경/날씨 설정] 접이식 열기 버튼 */}
            <div className="absolute top-3 right-3 z-10">
              <button
                type="button"
                onClick={() => setIsDetailPanelOpen(!isDetailPanelOpen)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl bg-[#13271C]/90 backdrop-blur-md border border-emerald-500/35 text-stone-200 hover:text-white shadow-lg active:scale-95 transition-all"
              >
                <SlidersHorizontal className="w-3.5 h-3.5 text-emerald-300" />
                <span>날씨/모먼트</span>
                <ChevronDown className={`w-3 h-3 text-stone-400 transition-transform ${isDetailPanelOpen ? 'rotate-180' : ''}`} />
              </button>
            </div>

            {/* 우상단 드롭다운 패널: 12대 날씨 & 숏컷 (화면을 가리지 않도록 접이식 수납) */}
            {isDetailPanelOpen && (
              <div className="absolute top-12 right-3 bg-[#13271C]/96 backdrop-blur-md p-3 rounded-2xl border border-emerald-500/40 shadow-2xl z-20 space-y-2.5 max-w-[300px] animate-in fade-in duration-150">
                {/* 12대 날씨 선택기 */}
                <div>
                  <p className="text-[10.5px] font-bold text-emerald-300 mb-1">날씨 시뮬레이션 프리셋</p>
                  <div className="grid grid-cols-4 gap-1">
                    {WEATHER_PRESETS.map((wp) => (
                      <button
                        key={wp.code}
                        type="button"
                        onClick={() => setWeatherCase(wp.code)}
                        className={`p-1 text-[10px] font-semibold rounded-lg text-center transition-all ${
                          weatherCase === wp.code
                            ? 'bg-emerald-600 text-white shadow-sm'
                            : 'bg-[#1D3A29] text-stone-300 hover:bg-[#254A34]'
                        }`}
                        title={wp.label}
                      >
                        <div>{wp.icon}</div>
                        <span className="text-[9px] block truncate">{wp.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* 6대 모먼트 숏컷 */}
                <div className="pt-1.5 border-t border-emerald-600/30">
                  <p className="text-[10.5px] font-bold text-amber-300 mb-1">주요 모먼트 바로가기</p>
                  <div className="grid grid-cols-3 gap-1">
                    <button
                      type="button"
                      onClick={() => jumpToMoment(1, 14)}
                      className="px-1.5 py-1 text-[10px] rounded bg-[#1D3A29] text-stone-200 hover:bg-emerald-700"
                    >
                      14:00 피칭
                    </button>
                    <button
                      type="button"
                      onClick={() => jumpToMoment(1, 15)}
                      className="px-1.5 py-1 text-[10px] rounded bg-amber-600/80 text-white hover:bg-amber-500"
                    >
                      15:00 그늘
                    </button>
                    <button
                      type="button"
                      onClick={() => jumpToMoment(1, 17)}
                      className="px-1.5 py-1 text-[10px] rounded bg-amber-700/80 text-white hover:bg-amber-600"
                    >
                      17:00 산그늘
                    </button>
                    <button
                      type="button"
                      onClick={() => jumpToMoment(1, 18.5)}
                      className="px-1.5 py-1 text-[10px] rounded bg-orange-700/80 text-white hover:bg-orange-600"
                    >
                      18:30 노을
                    </button>
                    <button
                      type="button"
                      onClick={() => jumpToMoment(1, 21)}
                      className="px-1.5 py-1 text-[10px] rounded bg-indigo-900/80 text-indigo-100 hover:bg-indigo-800"
                    >
                      21:00 불멍
                    </button>
                    <button
                      type="button"
                      onClick={() => jumpToMoment(2, 6.5)}
                      className="px-1.5 py-1 text-[10px] rounded bg-amber-800/80 text-amber-100 hover:bg-amber-700"
                    >
                      06:30 일출
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* 하단 플로팅 컨트롤러: 타임랩스 재생 바 & 일정/계절 */}
            <div className="absolute bottom-4 left-3 right-3 bg-[#1C3B29]/95 backdrop-blur-md p-3.5 rounded-2xl border border-emerald-500/40 shadow-2xl max-w-lg mx-auto space-y-2.5 z-10">
              {/* 일정 및 계절 선택 바 */}
              <div className="flex flex-wrap items-center justify-between gap-1 pb-2 border-b border-emerald-600/30">
                <div className="flex items-center gap-1.5 text-xs text-stone-200">
                  <Calendar className="w-3.5 h-3.5 text-emerald-300" />
                  <span className="font-semibold">일정:</span>
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
                        className={`px-1.5 py-0.5 text-[10.5px] font-bold rounded transition-all ${
                          duration === dur ? 'bg-[#2E7D47] text-white' : 'text-stone-300 hover:text-white'
                        }`}
                      >
                        {dur === '1N2D' ? '1박(15초)' : dur === '2N3D' ? '2박(30초)' : '3박(45초)'}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-1 text-[11px] text-stone-300">
                  <span className="text-[10px] text-stone-400">계절:</span>
                  <div className="flex bg-[#12271B] p-0.5 rounded-lg border border-emerald-600/30">
                    {[
                      { id: 'summer', label: '여름' },
                      { id: 'autumn', label: '가을' },
                      { id: 'winter', label: '겨울' },
                      { id: 'spring', label: '봄' },
                    ].map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => setSeason(s.id as any)}
                        className={`px-1.5 py-0.5 text-[10px] font-bold rounded transition-all ${
                          season === s.id ? 'bg-amber-600 text-white' : 'text-stone-300 hover:text-white'
                        }`}
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* 타임랩스 재생 컨트롤 & 슬라이더 */}
              <div>
                <div className="flex items-center justify-between text-xs font-semibold mb-1">
                  <div className="flex items-center gap-1.5 text-amber-300">
                    <Sun className="w-3.5 h-3.5" />
                    <span>
                      {currentDay}일차 {weatherLighting.timeStr}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setIsPlaying(!isPlaying)}
                      className="flex items-center gap-1 px-2.5 py-0.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold shadow-sm active:scale-95 transition-all cursor-pointer"
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
                      title="입실 시각으로 리셋"
                    >
                      <RotateCcw className="w-3 h-3" />
                    </button>
                  </div>
                </div>

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
            </div>
          </Suspense>
        ) : (
          /* 결과 카드 탭 */
          <div className="p-4 w-full max-w-md mx-auto overflow-y-auto max-h-full space-y-3.5 pb-8">
            <div className="flex items-center justify-between bg-[#1C3B29] p-3 rounded-2xl border border-emerald-500/30">
              <div>
                <p className="text-xs font-bold text-white">가상 피칭 분석 리포트</p>
                <p className="text-[11px] text-stone-300">
                  {site.name} ({site.widthM}×{site.depthM}m)
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
                오후 서쪽 직사광이 텐트 거실로 직접 비치는 것을 차단하고, 서남서 골바람을 텐트 후면으로 흘려보내는 최적 각도입니다.
              </p>
            </div>

            <div className="bg-[#1C3B29] p-4 rounded-2xl border border-amber-500/40 shadow-xl">
              <h4 className="text-sm font-bold text-amber-300 mb-2 flex items-center gap-1.5">
                <ShieldAlert className="w-4 h-4" />
                <span>주풍향 보강 팩 안내</span>
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
          </div>
        )}
      </div>

      {/* 진입 2-Track 모달 */}
      <PitchingEntryModal
        isOpen={isEntryModalOpen}
        onClose={() => setIsEntryModalOpen(false)}
        onSelect={handleEntrySelect}
      />
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
