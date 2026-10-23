'use client';

import React, { useState, useEffect, useMemo, Component, ErrorInfo, ReactNode } from 'react';
import {
  MapPin,
  Compass,
  ArrowUp,
  ChevronLeft,
  Check,
  RotateCw,
  RotateCcw,
  Sparkles,
  AlertTriangle,
  RefreshCw,
  Minus,
  Plus,
} from 'lucide-react';
import { Map, CustomOverlayMap, Polygon, useKakaoLoader } from 'react-kakao-maps-sdk';
import { toast } from 'sonner';
import type { SiteGeometry } from '../../types';

interface SiteMapPickerProps {
  site: SiteGeometry;
  onConfirmSite: (updatedSite: SiteGeometry) => void;
  onBack: () => void;
}

// 🛡️ [내부 Error Boundary] 카카오 지도 로딩 에러 시 화면 내에서 안전 복구
interface ErrorBoundaryProps {
  children: ReactNode;
  fallbackSite: SiteGeometry;
  onFallbackConfirm: (site: SiteGeometry) => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

class SiteMapPickerErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('🚨 [SiteMapPicker 내부 에러 감지]:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center text-stone-200 bg-[#16291C] space-y-4">
          <div className="w-12 h-12 rounded-full bg-amber-500/20 flex items-center justify-center text-amber-300 border border-amber-400/40">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white mb-1">
              위성 지도 환경을 초기화하는 중입니다
            </h3>
            <p className="text-xs text-stone-300 max-w-sm leading-relaxed">
              기본 피칭 사이트 위치로 바로 이동하여 텐트 배치를 계속 진행할 수 있습니다.
            </p>
          </div>
          <button
            type="button"
            onClick={() => this.props.onFallbackConfirm(this.props.fallbackSite)}
            className="px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold rounded-xl shadow-lg transition-all active:scale-95 cursor-pointer"
          >
            기본 사이트 위치로 계속 진행하기 (Step 2 ➔)
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function SiteMapPicker(props: SiteMapPickerProps) {
  return (
    <SiteMapPickerErrorBoundary
      fallbackSite={props.site}
      onFallbackConfirm={props.onConfirmSite}
    >
      <SiteMapPickerInternal {...props} />
    </SiteMapPickerErrorBoundary>
  );
}

function SiteMapPickerInternal({ site, onConfirmSite, onBack }: SiteMapPickerProps) {
  // 1. 카카오 지도 SDK 로드
  const [loading, error] = useKakaoLoader({
    appkey: process.env.NEXT_PUBLIC_KAKAO_JS_KEY || '',
    libraries: ['services', 'clusterer'],
  });

  // 지도 타입 (기본: SKYVIEW 위성지도)
  const [mapType, setMapType] = useState<'SKYVIEW' | 'ROADMAP'>('SKYVIEW');

  // 사이트 앵커링 좌표 (위도, 경도)
  const [pinLat, setPinLat] = useState<number>(site.lat || 36.6354349);
  const [pinLng, setPinLng] = useState<number>(site.lng || 126.7638091);

  // 사이트 규격(m) 및 회전 방위각(deg)
  const [widthM, setWidthM] = useState<number>(site.widthM || 8);
  const [depthM, setDepthM] = useState<number>(site.depthM || 7);
  const [bearingDeg, setBearingDeg] = useState<number>(site.bearingDeg || 135);

  // 입력창 전용 문자열 상태 (12m 입력 시 3~25 강제 가로챔 방지)
  const [widthInput, setWidthInput] = useState<string>(String(site.widthM || 8));
  const [depthInput, setDepthInput] = useState<string>(String(site.depthM || 7));

  // 지도 준비 완료 상태
  const [isMapReady, setIsMapReady] = useState<boolean>(false);
  const [zoomLevel, setZoomLevel] = useState<number>(1);

  // Step 2에서 뒤로 복귀 시 prop 양방향 동기화
  useEffect(() => {
    if (site.lat && site.lng) {
      setPinLat(site.lat);
      setPinLng(site.lng);
    }
    if (site.widthM) {
      setWidthM(site.widthM);
      setWidthInput(String(site.widthM));
    }
    if (site.depthM) {
      setDepthM(site.depthM);
      setDepthInput(String(site.depthM));
    }
    if (site.bearingDeg !== undefined) setBearingDeg(site.bearingDeg);
  }, [site.lat, site.lng, site.widthM, site.depthM, site.bearingDeg]);

  // 🧭 지도의 실제 지형과 1:1 실측으로 밀착되는 4개 꼭짓점 위경도 좌표 계산 (Polygon)
  const sitePolygonPath = useMemo(() => {
    // 위도 1도당 실제 거리 (약 111,320m)
    const metersPerLat = 111320;
    // 경도 1도당 실제 거리 (위도 36.6도 기준 약 89,200m)
    const radLat = (pinLat * Math.PI) / 180;
    const metersPerLng = 111320 * Math.cos(radLat);

    // 진입로 방위각 기준 단위벡터
    const bearingRad = (bearingDeg * Math.PI) / 180;
    const forwardEast = Math.sin(bearingRad);
    const forwardNorth = Math.cos(bearingRad);
    const rightEast = Math.cos(bearingRad);
    const rightNorth = -Math.sin(bearingRad);

    const halfW = widthM / 2;
    const halfD = depthM / 2;

    // 4개 모서리 오프셋 (u: 오른쪽 m, v: 앞쪽 m)
    const corners = [
      { u: -halfW, v: halfD },  // 1. 앞쪽-좌측
      { u: halfW, v: halfD },   // 2. 앞쪽-우측
      { u: halfW, v: -halfD },  // 3. 뒤쪽-우측
      { u: -halfW, v: -halfD }, // 4. 뒤쪽-좌측
    ];

    return corners.map((corner) => {
      const dEast = corner.u * rightEast + corner.v * forwardEast;
      const dNorth = corner.u * rightNorth + corner.v * forwardNorth;
      return {
        lat: pinLat + dNorth / metersPerLat,
        lng: pinLng + dEast / metersPerLng,
      };
    });
  }, [pinLat, pinLng, widthM, depthM, bearingDeg]);

  // 지도 클릭 시 중심 앵커 이동
  const handleMapClick = (_target: any, mouseEvent: any) => {
    if (!mouseEvent || !mouseEvent.latLng) return;
    const lat = mouseEvent.latLng.getLat();
    const lng = mouseEvent.latLng.getLng();
    setPinLat(lat);
    setPinLng(lng);
    toast.success('사이트 위치를 지정했습니다.', { duration: 1500 });
  };

  // 회전각 조절
  const handleRotate = (deltaDeg: number) => {
    setBearingDeg((prev) => (prev + deltaDeg + 360) % 360);
  };

  // 수치 입력 핸들러 (자유 입력 허용 + 포커스 아웃 시 범위 보정)
  const handleWidthChange = (valStr: string) => {
    setWidthInput(valStr);
    const val = parseFloat(valStr);
    if (!isNaN(val) && val >= 3 && val <= 25) {
      setWidthM(val);
    }
  };

  const handleWidthBlur = () => {
    let val = parseFloat(widthInput);
    if (isNaN(val)) val = 8;
    val = Math.max(3, Math.min(25, Math.round(val * 10) / 10));
    setWidthM(val);
    setWidthInput(String(val));
  };

  const handleDepthChange = (valStr: string) => {
    setDepthInput(valStr);
    const val = parseFloat(valStr);
    if (!isNaN(val) && val >= 3 && val <= 25) {
      setDepthM(val);
    }
  };

  const handleDepthBlur = () => {
    let val = parseFloat(depthInput);
    if (isNaN(val)) val = 7;
    val = Math.max(3, Math.min(25, Math.round(val * 10) / 10));
    setDepthM(val);
    setDepthInput(String(val));
  };

  // 1m 단위 증감 버튼
  const handleStepWidth = (delta: number) => {
    const next = Math.max(3, Math.min(25, widthM + delta));
    setWidthM(next);
    setWidthInput(String(next));
  };

  const handleStepDepth = (delta: number) => {
    const next = Math.max(3, Math.min(25, depthM + delta));
    setDepthM(next);
    setDepthInput(String(next));
  };

  // 자주 쓰는 규격 퀵 프리셋 (대표님 요청 철수네 12×12m 포함)
  const handleApplyPresetSize = (w: number, d: number) => {
    setWidthM(w);
    setDepthM(d);
    setWidthInput(String(w));
    setDepthInput(String(d));
    toast.info(`사이트 크기 ${w}m × ${d}m 설정 완료`);
  };

  // 최종 확정 후 Step 2로 이동
  const handleConfirm = () => {
    const updated: SiteGeometry = {
      ...site,
      lat: pinLat,
      lng: pinLng,
      widthM,
      depthM,
      bearingDeg,
    };
    onConfirmSite(updated);
  };

  return (
    <div className="relative h-[100dvh] w-full bg-[#121E15] flex flex-col overflow-hidden select-none">
      {/* 1. 상단 슬림 헤더 */}
      <header className="flex items-center justify-between px-3 sm:px-4 py-2 bg-[#1C3B29]/95 backdrop-blur-md border-b border-[#2A553C] shrink-0 z-30 shadow-md">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onBack}
            className="p-1 rounded-full text-emerald-200 hover:text-white hover:bg-emerald-800/40 transition-colors cursor-pointer"
            title="장소 재선택"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-xs sm:text-sm font-bold text-white flex items-center gap-1.5 leading-tight">
              <span>Step 1. 실제 사이트 위치 찍기</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-700/80 text-emerald-100 font-semibold border border-emerald-400/30">
                1:1 실측 위성뷰
              </span>
            </h1>
            <p className="text-[11px] text-emerald-200/80 truncate max-w-[200px] sm:max-w-md">
              {site.locationType === 'campground'
                ? `🏕️ ${site.campgroundName || '라온아이'} · ${site.siteName || site.name}`
                : `📍 ${site.address || site.name}`}
            </p>
          </div>
        </div>

        {/* 위성 / 일반 지도 토글 */}
        <div className="flex items-center bg-[#12271B] p-0.5 rounded-lg border border-emerald-600/40">
          <button
            type="button"
            onClick={() => setMapType('SKYVIEW')}
            className={`px-2 py-1 text-[11px] font-bold rounded-md transition-all cursor-pointer ${
              mapType === 'SKYVIEW'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-stone-300 hover:text-white'
            }`}
          >
            위성
          </button>
          <button
            type="button"
            onClick={() => setMapType('ROADMAP')}
            className={`px-2 py-1 text-[11px] font-bold rounded-md transition-all cursor-pointer ${
              mapType === 'ROADMAP'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-stone-300 hover:text-white'
            }`}
          >
            일반
          </button>
        </div>
      </header>

      {/* 2. 메인 지도 뷰포트 (1:1 실측 연동 사각틀 Polygon 렌더링) */}
      <div
        className="relative flex-1 w-full bg-[#0E1A11] overflow-hidden"
        style={{ touchAction: 'pan-x pan-y' }}
      >
        {loading ? (
          <div className="w-full h-full flex flex-col items-center justify-center gap-3 text-emerald-300">
            <RefreshCw className="w-8 h-8 text-emerald-400 animate-spin" />
            <span className="text-xs font-semibold">카카오 고해상도 위성지도를 불러오는 중...</span>
          </div>
        ) : error || !process.env.NEXT_PUBLIC_KAKAO_JS_KEY ? (
          <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center text-stone-200 bg-[#16291C]">
            <MapPin className="w-12 h-12 text-emerald-400 mb-2" />
            <h3 className="text-base font-bold text-white mb-1">위성지도를 불러올 수 없습니다</h3>
            <p className="text-xs text-stone-300 mb-4 max-w-sm">
              네트워크 상태를 확인해주세요. 기본 사이트 위치로 텐트 배치를 계속 진행할 수 있습니다.
            </p>
            <button
              type="button"
              onClick={handleConfirm}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl shadow-lg cursor-pointer"
            >
              기본 위치로 계속 진행하기 (Step 2 ➔)
            </button>
          </div>
        ) : (
          <Map
            center={{ lat: pinLat, lng: pinLng }}
            style={{ width: '100%', height: '100%' }}
            level={zoomLevel}
            mapTypeId={mapType === 'SKYVIEW' ? 'SKYVIEW' : 'ROADMAP'}
            onClick={handleMapClick}
            onCreate={() => setIsMapReady(true)}
          >
            {/* 🎯 [지도의 실제 축척과 100% 1:1 실측 연동 사각틀] 확대/축소 시 지형과 함께 크기가 완벽히 상호작용! */}
            {isMapReady && (
              <Polygon
                path={sitePolygonPath}
                strokeWeight={3}
                strokeColor="#F59E0B"
                strokeOpacity={0.95}
                strokeStyle="solid"
                fillColor="#F59E0B"
                fillOpacity={0.28}
              />
            )}

            {/* 사각틀 중앙 라벨 & 진입로 나침반 오버레이 */}
            {isMapReady && typeof window !== 'undefined' && window.kakao?.maps && (
              <CustomOverlayMap position={{ lat: pinLat, lng: pinLng }} yAnchor={0.5} xAnchor={0.5}>
                <div className="flex flex-col items-center justify-center pointer-events-none select-none">
                  {/* 진입로 방향 지시 화살표 */}
                  <div
                    className="flex items-center gap-1 bg-amber-500 text-black px-2 py-0.5 rounded-full text-[10px] font-black shadow-lg border border-white mb-1 transition-transform"
                    style={{
                      transform: `rotate(${bearingDeg}deg)`,
                      transformOrigin: 'center 20px',
                    }}
                  >
                    <ArrowUp className="w-3 h-3 stroke-[3]" />
                    <span>진입로</span>
                  </div>

                  {/* 사이트 실측 크기 라벨 */}
                  <div className="bg-black/85 backdrop-blur-xs text-amber-200 border border-amber-400/80 px-2 py-0.5 rounded-lg text-[10px] font-bold shadow-xl font-mono">
                    {widthM}m × {depthM}m
                  </div>
                  <div className="w-2.5 h-2.5 rounded-full bg-red-500 border border-white shadow-md mt-0.5" />
                </div>
              </CustomOverlayMap>
            )}
          </Map>
        )}

        {/* 안내 플로팅 배지 */}
        <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-[#12271B]/90 backdrop-blur-md border border-emerald-500/50 text-white px-3 py-1 rounded-full shadow-lg flex items-center gap-1.5 text-xs font-semibold z-10 pointer-events-none">
          <Sparkles className="w-3.5 h-3.5 text-amber-300 shrink-0" />
          <span>지도를 콕 터치하면 1:1 실측 사각틀이 이동합니다</span>
        </div>
      </div>

      {/* 3. 하단 사이트 크기 & 회전 컨트롤러 및 확정 바 */}
      <footer className="bg-[#1C3B29] border-t border-[#2A553C] p-3 sm:p-4 shrink-0 z-30 shadow-2xl space-y-2.5 pb-safe">
        {/* 자주 쓰는 대표 크기 퀵 프리셋 버튼 */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 scrollbar-none">
          <span className="text-[10px] font-bold text-emerald-300 shrink-0">빠른 설정:</span>
          <button
            type="button"
            onClick={() => handleApplyPresetSize(8, 7)}
            className={`px-2 py-0.5 text-[11px] font-bold rounded-lg border transition-all cursor-pointer ${
              widthM === 8 && depthM === 7
                ? 'bg-emerald-600 border-emerald-400 text-white shadow'
                : 'bg-[#12271B] border-emerald-700/50 text-stone-300 hover:text-white'
            }`}
          >
            표준 8×7m
          </button>
          <button
            type="button"
            onClick={() => handleApplyPresetSize(10, 8)}
            className={`px-2 py-0.5 text-[11px] font-bold rounded-lg border transition-all cursor-pointer ${
              widthM === 10 && depthM === 8
                ? 'bg-emerald-600 border-emerald-400 text-white shadow'
                : 'bg-[#12271B] border-emerald-700/50 text-stone-300 hover:text-white'
            }`}
          >
            대형 10×8m
          </button>
          <button
            type="button"
            onClick={() => handleApplyPresetSize(12, 12)}
            className={`px-2 py-0.5 text-[11px] font-bold rounded-lg border transition-all cursor-pointer ${
              widthM === 12 && depthM === 12
                ? 'bg-amber-600 border-amber-400 text-white shadow'
                : 'bg-[#12271B] border-emerald-700/50 text-amber-200 hover:text-white'
            }`}
          >
            철수네 12×12m ⭐
          </button>
        </div>

        {/* 사이트 크기 입력 및 회전 컨트롤 바 */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          {/* 가로 × 세로 정밀 조절 (자유 타이핑 + 증감 버튼) */}
          <div className="flex items-center gap-2 bg-[#12271B] px-2.5 py-1.5 rounded-xl border border-emerald-600/40">
            <span className="text-[11px] font-bold text-emerald-300">사이트:</span>
            
            {/* 가로 (Width) 조절 */}
            <div className="flex items-center gap-0.5">
              <button
                type="button"
                onClick={() => handleStepWidth(-1)}
                className="w-5 h-5 rounded bg-[#1C3B29] hover:bg-emerald-700 text-stone-200 flex items-center justify-center text-xs active:scale-95 cursor-pointer"
                title="1m 축소"
              >
                <Minus className="w-3 h-3" />
              </button>
              <input
                type="text"
                inputMode="numeric"
                value={widthInput}
                onChange={(e) => handleWidthChange(e.target.value)}
                onBlur={handleWidthBlur}
                className="w-8 px-0.5 py-0.5 text-center text-xs font-bold bg-[#1C3B29] border border-emerald-500/50 rounded text-white"
              />
              <button
                type="button"
                onClick={() => handleStepWidth(1)}
                className="w-5 h-5 rounded bg-[#1C3B29] hover:bg-emerald-700 text-stone-200 flex items-center justify-center text-xs active:scale-95 cursor-pointer"
                title="1m 확대"
              >
                <Plus className="w-3 h-3" />
              </button>
            </div>

            <span className="text-xs text-stone-400 font-bold">×</span>

            {/* 세로 (Depth) 조절 */}
            <div className="flex items-center gap-0.5">
              <button
                type="button"
                onClick={() => handleStepDepth(-1)}
                className="w-5 h-5 rounded bg-[#1C3B29] hover:bg-emerald-700 text-stone-200 flex items-center justify-center text-xs active:scale-95 cursor-pointer"
                title="1m 축소"
              >
                <Minus className="w-3 h-3" />
              </button>
              <input
                type="text"
                inputMode="numeric"
                value={depthInput}
                onChange={(e) => handleDepthChange(e.target.value)}
                onBlur={handleDepthBlur}
                className="w-8 px-0.5 py-0.5 text-center text-xs font-bold bg-[#1C3B29] border border-emerald-500/50 rounded text-white"
              />
              <button
                type="button"
                onClick={() => handleStepDepth(1)}
                className="w-5 h-5 rounded bg-[#1C3B29] hover:bg-emerald-700 text-stone-200 flex items-center justify-center text-xs active:scale-95 cursor-pointer"
                title="1m 확대"
              >
                <Plus className="w-3 h-3" />
              </button>
            </div>
            <span className="text-xs font-semibold text-emerald-200">m</span>
          </div>

          {/* 사이트 방향(진입로) 회전 컨트롤 */}
          <div className="flex items-center gap-1.5 bg-[#12271B] px-2.5 py-1.5 rounded-xl border border-emerald-600/40">
            <span className="text-[11px] font-bold text-emerald-300 flex items-center gap-1">
              <Compass className="w-3.5 h-3.5 text-amber-400" />
              <span>진입로:</span>
            </span>
            <button
              type="button"
              onClick={() => handleRotate(-15)}
              className="px-2 py-0.5 text-xs font-bold rounded bg-[#1C3B29] hover:bg-[#254F37] text-white flex items-center gap-0.5 active:scale-95 cursor-pointer"
              title="반시계 15도 회전"
            >
              <RotateCcw className="w-3 h-3" />
              <span>-15°</span>
            </button>
            <span className="text-xs font-mono font-bold text-amber-300 min-w-[34px] text-center">
              {Math.round(bearingDeg)}°
            </span>
            <button
              type="button"
              onClick={() => handleRotate(15)}
              className="px-2 py-0.5 text-xs font-bold rounded bg-[#1C3B29] hover:bg-[#254F37] text-white flex items-center gap-0.5 active:scale-95 cursor-pointer"
              title="시계 15도 회전"
            >
              <span>+15°</span>
              <RotateCw className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* 최종 Step 2 이동 버튼 */}
        <button
          type="button"
          onClick={handleConfirm}
          className="w-full py-2.5 sm:py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 active:scale-[0.99] text-white font-bold text-sm shadow-xl flex items-center justify-center gap-2 cursor-pointer transition-all"
        >
          <Check className="w-4 h-4 text-emerald-100" />
          <span>이 위치에 텐트 배치하기 (Step 2 이동)</span>
        </button>
      </footer>
    </div>
  );
}
