'use client';

import React, { useState, useEffect, useMemo, useRef, Component, ErrorInfo, ReactNode } from 'react';
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
  Move,
  Shapes,
  Square,
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

  // 지도 인스턴스 및 컨테이너 참조
  const mapRef = useRef<any>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);

  // 드래그 조작 중/직후 지도 클릭 오발동 방지 ref
  const isInteractingRef = useRef<boolean>(false);
  const lastInteractionTimeRef = useRef<number>(0);

  // 지도 타입 (기본: SKYVIEW 위성지도)
  const [mapType, setMapType] = useState<'SKYVIEW' | 'ROADMAP'>('SKYVIEW');

  // 사이트 앵커링 좌표 (위도, 경도)
  const [pinLat, setPinLat] = useState<number>(site.lat || 36.6354349);
  const [pinLng, setPinLng] = useState<number>(site.lng || 126.7638091);

  // 사이트 규격(m) 및 회전 방위각(deg)
  const [widthM, setWidthM] = useState<number>(site.widthM || 8);
  const [depthM, setDepthM] = useState<number>(site.depthM || 7);
  const [bearingDeg, setBearingDeg] = useState<number>(site.bearingDeg || 135);

  // 입력창 전용 문자열 상태
  const [widthInput, setWidthInput] = useState<string>(String(site.widthM || 8));
  const [depthInput, setDepthInput] = useState<string>(String(site.depthM || 7));

  // 지도 준비 완료 상태
  const [isMapReady, setIsMapReady] = useState<boolean>(false);
  const [zoomLevel, setZoomLevel] = useState<number>(1);

  // 사이트 형태 모드: 'RECTANGLE' (직사각형) | 'POLYGON' (비정형 다각형 모서리 핀)
  const [shapeMode, setShapeMode] = useState<'RECTANGLE' | 'POLYGON'>('RECTANGLE');

  // 비정형 다각형 모드일 때 4개 꼭짓점 오프셋 (u: 오른쪽 m, v: 앞쪽 m)
  const [cornerOffsets, setCornerOffsets] = useState<[number, number][]>([
    [-widthM / 2, depthM / 2],  // 0: 앞-좌
    [widthM / 2, depthM / 2],   // 1: 앞-우
    [widthM / 2, -depthM / 2],  // 2: 뒤-우
    [-widthM / 2, -depthM / 2], // 3: 뒤-좌
  ]);

  // 터치 드래그 및 회전 조작 상태 ref
  const dragInteractionRef = useRef<{
    isDraggingMove: boolean;
    isRotating: boolean;
    draggingCornerIdx: number | null;
    startClientX: number;
    startClientY: number;
    startLat: number;
    startLng: number;
    startBearing: number;
  }>({
    isDraggingMove: false,
    isRotating: false,
    draggingCornerIdx: null,
    startClientX: 0,
    startClientY: 0,
    startLat: pinLat,
    startLng: pinLng,
    startBearing: bearingDeg,
  });

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

  // 직사각형 크기 변경 시 cornerOffsets 동기화
  useEffect(() => {
    if (shapeMode === 'RECTANGLE') {
      const halfW = widthM / 2;
      const halfD = depthM / 2;
      setCornerOffsets([
        [-halfW, halfD],
        [halfW, halfD],
        [halfW, -halfD],
        [-halfW, -halfD],
      ]);
    }
  }, [widthM, depthM, shapeMode]);

  // 🧭 지도의 실제 지형과 1:1 실측으로 밀착되는 4개 꼭짓점 위경도 좌표 계산 (Polygon)
  const { sitePolygonPath, forwardOuterPosition } = useMemo(() => {
    const metersPerLat = 111320;
    const radLat = (pinLat * Math.PI) / 180;
    const metersPerLng = 111320 * Math.cos(radLat);

    const bearingRad = (bearingDeg * Math.PI) / 180;
    const forwardEast = Math.sin(bearingRad);
    const forwardNorth = Math.cos(bearingRad);
    const rightEast = Math.cos(bearingRad);
    const rightNorth = -Math.sin(bearingRad);

    // 4개 모서리 위경도
    const path = cornerOffsets.map(([u, v]) => {
      const dEast = u * rightEast + v * forwardEast;
      const dNorth = u * rightNorth + v * forwardNorth;
      return {
        lat: pinLat + dNorth / metersPerLat,
        lng: pinLng + dEast / metersPerLng,
      };
    });

    // 사각형 앞쪽 변 바깥쪽(전면 외곽) 진입로 배지 위치 (depthM/2 + 1.4m 외곽)
    const outerDist = depthM / 2 + 1.4;
    const outerEast = outerDist * forwardEast;
    const outerNorth = outerDist * forwardNorth;
    const forwardOuterPos = {
      lat: pinLat + outerNorth / metersPerLat,
      lng: pinLng + outerEast / metersPerLng,
    };

    return { sitePolygonPath: path, forwardOuterPosition: forwardOuterPos };
  }, [pinLat, pinLng, bearingDeg, cornerOffsets, depthM]);

  // 1. 손가락 드래그 이동 시작 (사각틀 터치)
  const handlePointerDownMove = (e: React.PointerEvent) => {
    e.stopPropagation();
    if (!mapRef.current) return;

    // 인터랙션 진행 중 플래그 활성화 (지도 클릭 오발동 방지)
    isInteractingRef.current = true;
    mapRef.current.setDraggable(false);

    dragInteractionRef.current = {
      isDraggingMove: true,
      isRotating: false,
      draggingCornerIdx: null,
      startClientX: e.clientX,
      startClientY: e.clientY,
      startLat: pinLat,
      startLng: pinLng,
      startBearing: bearingDeg,
    };

    try {
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    } catch {}
  };

  // 2. 손가락 터치 회전 시작 (외곽 미니 ↺ 핸들)
  const handlePointerDownRotate = (e: React.PointerEvent) => {
    e.stopPropagation();
    if (!mapRef.current) return;

    isInteractingRef.current = true;
    mapRef.current.setDraggable(false);

    dragInteractionRef.current = {
      isDraggingMove: false,
      isRotating: true,
      draggingCornerIdx: null,
      startClientX: e.clientX,
      startClientY: e.clientY,
      startLat: pinLat,
      startLng: pinLng,
      startBearing: bearingDeg,
    };

    try {
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    } catch {}
  };

  // 3. 다각형 모서리 핀 드래그 시작 (모서리 번호 핀 터치)
  const handlePointerDownCorner = (e: React.PointerEvent, cornerIdx: number) => {
    e.stopPropagation();
    if (!mapRef.current) return;

    isInteractingRef.current = true;
    mapRef.current.setDraggable(false);

    dragInteractionRef.current = {
      isDraggingMove: false,
      isRotating: false,
      draggingCornerIdx: cornerIdx,
      startClientX: e.clientX,
      startClientY: e.clientY,
      startLat: pinLat,
      startLng: pinLng,
      startBearing: bearingDeg,
    };

    try {
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    } catch {}
  };

  // 드래그/회전 이동 처리 (Window Pointer Move)
  const handlePointerMove = (e: React.PointerEvent) => {
    const { isDraggingMove, isRotating, draggingCornerIdx } = dragInteractionRef.current;
    if (!isDraggingMove && !isRotating && draggingCornerIdx === null) return;
    if (!mapRef.current || typeof window === 'undefined' || !window.kakao?.maps) return;

    const proj = mapRef.current.getProjection();
    if (!proj) return;

    // 🎯 지도 컨테이너의 뷰포트 오프셋 계산 (화면 헤더 높이에 따른 좌표계 오차 100% 제거!)
    const containerRect = mapContainerRef.current?.getBoundingClientRect();
    const containerLeft = containerRect ? containerRect.left : 0;
    const containerTop = containerRect ? containerRect.top : 0;
    const currentContainerX = e.clientX - containerLeft;
    const currentContainerY = e.clientY - containerTop;

    // 1) 사각틀 전체 이동
    if (isDraggingMove) {
      const startCenterPoint = proj.containerPointFromCoords(
        new window.kakao.maps.LatLng(dragInteractionRef.current.startLat, dragInteractionRef.current.startLng)
      );
      const dx = e.clientX - dragInteractionRef.current.startClientX;
      const dy = e.clientY - dragInteractionRef.current.startClientY;

      startCenterPoint.x += dx;
      startCenterPoint.y += dy;

      const nextLatLng = proj.coordsFromContainerPoint(startCenterPoint);
      setPinLat(nextLatLng.getLat());
      setPinLng(nextLatLng.getLng());
    }

    // 2) 회전 핸들 회전
    else if (isRotating) {
      const centerPoint = proj.containerPointFromCoords(new window.kakao.maps.LatLng(pinLat, pinLng));
      const deltaX = currentContainerX - centerPoint.x;
      const deltaY = currentContainerY - centerPoint.y;

      // 상단(북쪽) 기준 시계방향 각도 계산
      const angleRad = Math.atan2(deltaX, -deltaY);
      let nextDeg = (angleRad * 180) / Math.PI;
      if (nextDeg < 0) nextDeg += 360;

      setBearingDeg(Math.round(nextDeg));
    }

    // 3) 비정형 다각형 모서리 핀 이동 (컨테이너 오프셋 정밀 보정 & 안전 클램프)
    else if (draggingCornerIdx !== null) {
      const currentPoint = proj.coordsFromContainerPoint(
        new window.kakao.maps.Point(currentContainerX, currentContainerY)
      );
      const metersPerLat = 111320;
      const radLat = (pinLat * Math.PI) / 180;
      const metersPerLng = 111320 * Math.cos(radLat);

      const dLat = currentPoint.getLat() - pinLat;
      const dLng = currentPoint.getLng() - pinLng;
      const dNorth = dLat * metersPerLat;
      const dEast = dLng * metersPerLng;

      const bearingRad = (bearingDeg * Math.PI) / 180;
      const forwardEast = Math.sin(bearingRad);
      const forwardNorth = Math.cos(bearingRad);
      const rightEast = Math.cos(bearingRad);
      const rightNorth = -Math.sin(bearingRad);

      // 역변환으로 로컬 (u, v) 산출
      const u = dEast * rightEast + dNorth * rightNorth;
      const v = dEast * forwardEast + dNorth * forwardNorth;

      // 🛡️ 안전 한계선: 중심에서 +-25m 이내로 제한 (순간적 찢어짐 원천 차단)
      const clampedU = Math.max(-25, Math.min(25, u));
      const clampedV = Math.max(-25, Math.min(25, v));

      setCornerOffsets((prev) => {
        const next = [...prev] as [number, number][];
        next[draggingCornerIdx] = [Math.round(clampedU * 10) / 10, Math.round(clampedV * 10) / 10];
        
        // 바운딩 박스 계산하여 widthM, depthM 동기화
        const allU = next.map((c) => c[0]);
        const allV = next.map((c) => c[1]);
        const newW = Math.max(3, Math.round(Math.max(...allU) - Math.min(...allU)));
        const newD = Math.max(3, Math.round(Math.max(...allV) - Math.min(...allV)));
        setWidthM(newW);
        setDepthM(newD);
        setWidthInput(String(newW));
        setDepthInput(String(newD));

        return next;
      });
    }
  };

  // 포인터 해제 및 지도 드래그 복원
  const handlePointerUp = (e: React.PointerEvent) => {
    // 인터랙션 종료 시점 기록 (이후 350ms 동안 지도 클릭 점프 차단)
    isInteractingRef.current = false;
    lastInteractionTimeRef.current = Date.now();

    if (
      dragInteractionRef.current.isDraggingMove ||
      dragInteractionRef.current.isRotating ||
      dragInteractionRef.current.draggingCornerIdx !== null
    ) {
      dragInteractionRef.current = {
        isDraggingMove: false,
        isRotating: false,
        draggingCornerIdx: null,
        startClientX: 0,
        startClientY: 0,
        startLat: pinLat,
        startLng: pinLng,
        startBearing: bearingDeg,
      };

      if (mapRef.current) {
        mapRef.current.setDraggable(true);
      }
      try {
        (e.target as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {}
    }
  };

  // 지도 빈 곳 클릭 시 중심 앵커 이동 (드래그 직후 오발동 차단)
  const handleMapClick = (_target: any, mouseEvent: any) => {
    // 드래그 조작 중이거나 손가락을 뗀 직후(350ms)에는 지도 클릭 무시
    if (isInteractingRef.current || Date.now() - lastInteractionTimeRef.current < 350) {
      return;
    }
    if (!mouseEvent || !mouseEvent.latLng) return;
    const lat = mouseEvent.latLng.getLat();
    const lng = mouseEvent.latLng.getLng();
    setPinLat(lat);
    setPinLng(lng);
    toast.success('사이트 위치를 지정했습니다.', { duration: 1500 });
  };

  // 회전각 미세 조절 버튼 (15도)
  const handleRotate = (deltaDeg: number) => {
    setBearingDeg((prev) => (prev + deltaDeg + 360) % 360);
  };

  // 수치 입력 핸들러
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

  // 표준 규격 퀵 프리셋
  const handleApplyPresetSize = (w: number, d: number) => {
    setWidthM(w);
    setDepthM(d);
    setWidthInput(String(w));
    setDepthInput(String(d));
    setShapeMode('RECTANGLE');
    toast.info(`사이트 규격 ${w}m × ${d}m 설정 완료`);
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
      polygonPoints: shapeMode === 'POLYGON' ? cornerOffsets : undefined,
    };
    onConfirmSite(updated);
  };

  return (
    <div
      className="relative h-[100dvh] w-full bg-[#121E15] flex flex-col overflow-hidden select-none"
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
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
            <p className="text-[11px] text-emerald-200/80 truncate max-w-[190px] sm:max-w-md">
              {site.locationType === 'campground'
                ? `🏕️ ${site.campgroundName || '라온아이'} · ${site.siteName || site.name}`
                : `📍 ${site.address || site.name}`}
            </p>
          </div>
        </div>

        {/* 형태 모드(직사각형/다각형) & 위성/일반 지도 토글 */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => {
              const nextMode = shapeMode === 'RECTANGLE' ? 'POLYGON' : 'RECTANGLE';
              setShapeMode(nextMode);
              toast.info(nextMode === 'POLYGON' ? '비정형 다각형 핀 모드 활성화' : '직사각형 모드 전환');
            }}
            className={`flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold rounded-lg border transition-all cursor-pointer whitespace-nowrap shrink-0 ${
              shapeMode === 'POLYGON'
                ? 'bg-amber-600 border-amber-400 text-white shadow-sm'
                : 'bg-[#12271B] border-emerald-700/50 text-stone-200 hover:text-white'
            }`}
            title="다각형 모서리 핀 조절"
          >
            {shapeMode === 'POLYGON' ? <Shapes className="w-3.5 h-3.5" /> : <Square className="w-3.5 h-3.5" />}
            <span>{shapeMode === 'POLYGON' ? '다각형 핀' : '직사각형'}</span>
          </button>

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
        </div>
      </header>

      {/* 2. 메인 지도 뷰포트 (1:1 실측 연동 Polygon + 투명 네모칸 + 외곽 미니 회전 핸들) */}
      <div
        ref={mapContainerRef}
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
            onCreate={(mapInstance) => {
              mapRef.current = mapInstance;
              setIsMapReady(true);
            }}
          >
            {/* 🎯 [지도의 실제 축척과 100% 1:1 실측 연동 사각틀 - 지형 투시 극대화] */}
            {isMapReady && (
              <Polygon
                path={sitePolygonPath}
                strokeWeight={2.5}
                strokeColor="#F59E0B"
                strokeOpacity={0.95}
                strokeStyle="solid"
                fillColor="#F59E0B"
                fillOpacity={0.16}
              />
            )}

            {/* 1) 사각틀 내부 중앙: 라벨/배지 완전 삭제! 지형 100% 노출 + 사각틀 드래그 이동 앵커 */}
            {isMapReady && typeof window !== 'undefined' && window.kakao?.maps && (
              <CustomOverlayMap position={{ lat: pinLat, lng: pinLng }} yAnchor={0.5} xAnchor={0.5}>
                <div
                  onPointerDown={handlePointerDownMove}
                  className="w-16 h-16 -m-8 flex items-center justify-center cursor-move touch-none select-none active:scale-110 transition-transform"
                  title="사각틀을 손가락으로 드래그하여 이동"
                >
                  {/* 지형을 가리지 않는 아주 작고 은은한 중앙 앵커 점 */}
                  <div className="w-2.5 h-2.5 rounded-full bg-amber-400/90 border border-white shadow-md ring-2 ring-black/40" />
                </div>
              </CustomOverlayMap>
            )}

            {/* 2) 사각형 전면 외곽: 진입로 배지 완전 삭제! 오직 미니 회전 핸들(↺)만 외곽에 배치 */}
            {isMapReady && typeof window !== 'undefined' && window.kakao?.maps && (
              <CustomOverlayMap position={forwardOuterPosition} yAnchor={0.5} xAnchor={0.5}>
                <div className="select-none pointer-events-auto">
                  <button
                    type="button"
                    onPointerDown={handlePointerDownRotate}
                    className="w-8 h-8 rounded-full bg-[#12271B]/95 border-2 border-amber-400 text-amber-300 flex items-center justify-center shadow-2xl cursor-grab active:cursor-grabbing hover:scale-110 active:scale-95 touch-none"
                    title="손가락으로 돌려 방향 맞추기"
                  >
                    <RotateCw className="w-4 h-4 stroke-[2.5]" />
                  </button>
                </div>
              </CustomOverlayMap>
            )}

            {/* 3) 다각형 모드일 때: 4개 모서리 조절 핀 핸들 (터치 영역 44px 확대 & 클릭 간섭 방지) */}
            {isMapReady && shapeMode === 'POLYGON' && typeof window !== 'undefined' && window.kakao?.maps && (
              sitePolygonPath.map((cornerPoint, idx) => (
                <CustomOverlayMap key={idx} position={cornerPoint} yAnchor={0.5} xAnchor={0.5}>
                  <div
                    onPointerDown={(e) => handlePointerDownCorner(e, idx)}
                    className="w-11 h-11 -m-5.5 flex items-center justify-center cursor-grab active:cursor-grabbing touch-none select-none"
                    title={`모서리 #${idx + 1} 드래그 조절`}
                  >
                    <div className="w-5 h-5 rounded-full bg-amber-500 border-2 border-white shadow-2xl flex items-center justify-center text-[10px] font-black text-black hover:scale-125 transition-transform">
                      {idx + 1}
                    </div>
                  </div>
                </CustomOverlayMap>
              ))
            )}
          </Map>
        )}

        {/* 안내 플로팅 배지 */}
        <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-[#12271B]/95 backdrop-blur-md border border-emerald-500/50 text-white px-3 py-1 rounded-full shadow-lg flex items-center gap-1.5 text-xs font-semibold z-10 pointer-events-none">
          <Sparkles className="w-3.5 h-3.5 text-amber-300 shrink-0" />
          <span>
            {shapeMode === 'POLYGON'
              ? '1~4번 모서리 핀을 드래그해 사이트 형태를 맞추세요'
              : '사각틀을 드래그해 옮기고 상단 ↺를 돌리세요'}
          </span>
        </div>
      </div>

      {/* 3. 하단 사이트 크기 & 회전 컨트롤러 및 확정 바 */}
      <footer className="bg-[#1C3B29] border-t border-[#2A553C] p-3 sm:p-4 shrink-0 z-30 shadow-2xl space-y-2.5 pb-safe">
        {/* 자주 쓰는 표준 규격 퀵 프리셋 버튼 (철수네 삭제 완료) */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 scrollbar-none">
          <span className="text-[10px] font-bold text-emerald-300 shrink-0">표준 규격:</span>
          <button
            type="button"
            onClick={() => handleApplyPresetSize(8, 7)}
            className={`px-2.5 py-0.5 text-[11px] font-bold rounded-lg border transition-all cursor-pointer ${
              widthM === 8 && depthM === 7 && shapeMode === 'RECTANGLE'
                ? 'bg-emerald-600 border-emerald-400 text-white shadow'
                : 'bg-[#12271B] border-emerald-700/50 text-stone-300 hover:text-white'
            }`}
          >
            표준 8×7m
          </button>
          <button
            type="button"
            onClick={() => handleApplyPresetSize(10, 8)}
            className={`px-2.5 py-0.5 text-[11px] font-bold rounded-lg border transition-all cursor-pointer ${
              widthM === 10 && depthM === 8 && shapeMode === 'RECTANGLE'
                ? 'bg-emerald-600 border-emerald-400 text-white shadow'
                : 'bg-[#12271B] border-emerald-700/50 text-stone-300 hover:text-white'
            }`}
          >
            대형 10×8m
          </button>
          <button
            type="button"
            onClick={() => handleApplyPresetSize(12, 10)}
            className={`px-2.5 py-0.5 text-[11px] font-bold rounded-lg border transition-all cursor-pointer ${
              widthM === 12 && depthM === 10 && shapeMode === 'RECTANGLE'
                ? 'bg-emerald-600 border-emerald-400 text-white shadow'
                : 'bg-[#12271B] border-emerald-700/50 text-stone-300 hover:text-white'
            }`}
          >
            특대형 12×10m
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

          {/* 사이트 방향(진입로) 회전 컨트롤 (15도 정밀 버튼 유지) */}
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
