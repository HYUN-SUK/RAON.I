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
} from 'lucide-react';
import { Map, CustomOverlayMap, useKakaoLoader } from 'react-kakao-maps-sdk';
import { toast } from 'sonner';
import type { SiteGeometry } from '../../types';

interface SiteMapPickerProps {
  site: SiteGeometry;
  onConfirmSite: (updatedSite: SiteGeometry) => void;
  onBack: () => void;
}

// 🛡️ [내부 Error Boundary] 카카오 지도 렌더 중 오류가 발생해도 global-error로 튕기지 않고 화면 내에서 안전 복구
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
    console.error('🚨 [SiteMapPicker 내부 에러 감지 및 격리 방어]:', error, errorInfo);
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
              기기 네트워크 환경에 따라 지도가 일시 지연될 수 있습니다. 기본 피칭 사이트 위치로 바로 이동하여 텐트 배치를 계속 진행할 수 있습니다.
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
  // 1. 카카오 지도 SDK 로드 (기존 라온아이 시스템과 100% 동일한 libraries 옵션으로 로더 충돌 완전 차단!)
  const [loading, error] = useKakaoLoader({
    appkey: process.env.NEXT_PUBLIC_KAKAO_JS_KEY || '',
    libraries: ['services', 'clusterer'],
  });

  // 지도 타입 (기본: SKYVIEW 위성지도)
  const [mapType, setMapType] = useState<'SKYVIEW' | 'ROADMAP'>('SKYVIEW');

  // 사이트 앵커링 좌표 (위도, 경도)
  const [pinLat, setPinLat] = useState<number>(site.lat || 36.6354349);
  const [pinLng, setPinLng] = useState<number>(site.lng || 126.7638091);

  // 사이트 규격 및 회전 방위각
  const [widthM, setWidthM] = useState<number>(site.widthM || 8);
  const [depthM, setDepthM] = useState<number>(site.depthM || 7);
  const [bearingDeg, setBearingDeg] = useState<number>(site.bearingDeg || 135);

  // 지도 인스턴스 준비 완료 여부 (지도가 준비된 후에만 CustomOverlayMap 렌더링하여 kakao is not defined 원천 방지)
  const [isMapReady, setIsMapReady] = useState<boolean>(false);

  // 지도 줌 레벨 (1~2 레벨: 초고해상도 피칭 사이트 뷰)
  const [zoomLevel, setZoomLevel] = useState<number>(1);

  // Step 2에서 뒤로가기로 복귀했을 때 prop 변경값과 내부 state 양방향 동기화
  useEffect(() => {
    if (site.lat && site.lng) {
      setPinLat(site.lat);
      setPinLng(site.lng);
    }
    if (site.widthM) setWidthM(site.widthM);
    if (site.depthM) setDepthM(site.depthM);
    if (site.bearingDeg !== undefined) setBearingDeg(site.bearingDeg);
  }, [site.lat, site.lng, site.widthM, site.depthM, site.bearingDeg]);

  // 지도 클릭 핸들러 (지형을 콕 찍으면 앵커 이동)
  const handleMapClick = (_target: any, mouseEvent: any) => {
    if (!mouseEvent || !mouseEvent.latLng) return;
    const lat = mouseEvent.latLng.getLat();
    const lng = mouseEvent.latLng.getLng();
    setPinLat(lat);
    setPinLng(lng);
    toast.success('사이트 위치를 지정했습니다. 크기와 방향을 맞춘 뒤 다음으로 진행하세요.', {
      duration: 2000,
    });
  };

  // 회전각 조절
  const handleRotate = (deltaDeg: number) => {
    setBearingDeg((prev) => (prev + deltaDeg + 360) % 360);
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
      <header className="flex items-center justify-between px-3 sm:px-4 py-2.5 bg-[#1C3B29]/95 backdrop-blur-md border-b border-[#2A553C] shrink-0 z-30 shadow-md">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onBack}
            className="p-1 rounded-full text-emerald-200 hover:text-white hover:bg-emerald-800/40 transition-colors"
            title="장소 재선택"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-xs sm:text-sm font-bold text-white flex items-center gap-1.5 leading-tight">
              <span>Step 1. 실제 사이트 위치 찍기</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-700/80 text-emerald-100 font-semibold border border-emerald-400/30">
                위성 스카이뷰
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
            className={`px-2 py-1 text-[11px] font-bold rounded-md transition-all ${
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
            className={`px-2 py-1 text-[11px] font-bold rounded-md transition-all ${
              mapType === 'ROADMAP'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-stone-300 hover:text-white'
            }`}
          >
            일반
          </button>
        </div>
      </header>

      {/* 2. 메인 지도 뷰포트 (모바일 제스처 간섭 방지) */}
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
            {/* 지도가 완전히 생성되고 kakao 전역 객체가 준비되었을 때만 안전 렌더링 */}
            {isMapReady && typeof window !== 'undefined' && window.kakao?.maps && (
              <CustomOverlayMap position={{ lat: pinLat, lng: pinLng }} yAnchor={0.5} xAnchor={0.5}>
                <div
                  className="relative flex items-center justify-center pointer-events-none transition-transform duration-150"
                  style={{
                    transform: `rotate(${bearingDeg}deg)`,
                  }}
                >
                  {/* 실제 사이트 사각틀 바운더리 (노란 테두리 + 반투명 채움) */}
                  <div
                    className="border-2 border-amber-400 bg-amber-400/25 rounded-lg shadow-2xl flex flex-col items-center justify-between p-1.5"
                    style={{
                      width: `${Math.max(70, widthM * 11)}px`,
                      height: `${Math.max(60, depthM * 11)}px`,
                    }}
                  >
                    {/* 진입로 화살표 */}
                    <div className="flex items-center gap-1 bg-amber-500/95 text-black px-1.5 py-0.5 rounded-full text-[9px] font-extrabold shadow">
                      <ArrowUp className="w-2.5 h-2.5" />
                      <span>진입로</span>
                    </div>

                    {/* 크기 라벨 */}
                    <div className="bg-black/75 px-1.5 py-0.5 rounded text-[9.5px] font-bold text-amber-200">
                      {widthM}m × {depthM}m
                    </div>
                  </div>

                  {/* 중앙 앵커 핀 포인트 */}
                  <div className="absolute w-3 h-3 rounded-full bg-red-500 border-2 border-white shadow-md" />
                </div>
              </CustomOverlayMap>
            )}
          </Map>
        )}

        {/* 안내 플로팅 배지 */}
        <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-[#12271B]/90 backdrop-blur-md border border-emerald-500/50 text-white px-3 py-1.5 rounded-full shadow-lg flex items-center gap-1.5 text-xs font-semibold z-10 pointer-events-none">
          <Sparkles className="w-3.5 h-3.5 text-amber-300 shrink-0" />
          <span>지도를 콕 터치하여 텐트 칠 자리를 지정하세요</span>
        </div>
      </div>

      {/* 3. 하단 플로팅 사이트 크기 & 회전 컨트롤러 및 확정 바 */}
      <footer className="bg-[#1C3B29] border-t border-[#2A553C] p-3 sm:p-4 shrink-0 z-30 shadow-2xl space-y-3 pb-safe">
        <div className="flex flex-wrap items-center justify-between gap-2">
          {/* 사이트 크기 조절 (가로 × 세로) */}
          <div className="flex items-center gap-2 bg-[#12271B] px-3 py-1.5 rounded-xl border border-emerald-600/40">
            <span className="text-[11px] font-bold text-emerald-300">사이트 크기:</span>
            <div className="flex items-center gap-1">
              <input
                type="number"
                value={widthM}
                onChange={(e) => setWidthM(Math.max(3, Math.min(25, Number(e.target.value))))}
                className="w-12 px-1 py-0.5 text-center text-xs font-bold bg-[#1C3B29] border border-emerald-500/50 rounded text-white"
                min={3}
                max={25}
              />
              <span className="text-xs text-stone-300">×</span>
              <input
                type="number"
                value={depthM}
                onChange={(e) => setDepthM(Math.max(3, Math.min(25, Number(e.target.value))))}
                className="w-12 px-1 py-0.5 text-center text-xs font-bold bg-[#1C3B29] border border-emerald-500/50 rounded text-white"
                min={3}
                max={25}
              />
              <span className="text-xs font-semibold text-emerald-200">m</span>
            </div>
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
            <span className="text-xs font-mono font-bold text-amber-300 min-w-[36px] text-center">
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
          className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 active:scale-[0.99] text-white font-bold text-sm shadow-xl flex items-center justify-center gap-2 cursor-pointer transition-all"
        >
          <Check className="w-4 h-4 text-emerald-100" />
          <span>이 위치에 텐트 배치하기 (Step 2 이동)</span>
        </button>
      </footer>
    </div>
  );
}
