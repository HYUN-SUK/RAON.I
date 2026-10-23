'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Tent,
  Trash2,
  RotateCw,
  RotateCcw,
  Plus,
  Play,
  ArrowUp,
  Maximize2,
  TreePine,
  Zap,
  Car,
  ChevronLeft,
  Sparkles,
  Info,
  X,
  Compass,
} from 'lucide-react';
import { toast } from 'sonner';
import type { SiteGeometry, PlacedGearItem, PlacedGearType, SiteObstacle } from '../../types';

interface SitePlacementEditorProps {
  site: SiteGeometry;
  onUpdateSite: (updated: SiteGeometry) => void;
  placedGears: PlacedGearItem[];
  onUpdateGears: (gears: PlacedGearItem[]) => void;
  onStartSimulation: () => void;
  onBackToEntry: () => void;
}

// 텐트 프리셋 템플릿
interface GearPreset {
  type: PlacedGearType;
  name: string;
  category: 'tent' | 'tarp';
  lengthM: number;
  widthM: number;
  heightM: number;
  color: string;
}

const PRESET_GEARS: GearPreset[] = [
  {
    type: 'tunnel_tent',
    name: '표준 터널형 텐트',
    category: 'tent',
    lengthM: 6.2,
    widthM: 3.3,
    heightM: 2.1,
    color: '#4B5320', // 올리브 카키
  },
  {
    type: 'dome_tent',
    name: '돔 텐트',
    category: 'tent',
    lengthM: 3.2,
    widthM: 3.2,
    heightM: 1.8,
    color: '#C2B280', // 샌드 베이지
  },
  {
    type: 'livingshell_tent',
    name: '대형 거실형(리빙쉘)',
    category: 'tent',
    lengthM: 5.8,
    widthM: 3.6,
    heightM: 2.15,
    color: '#37474F', // 다크 차콜
  },
  {
    type: 'recta_tarp',
    name: '렉타(사각) 타프',
    category: 'tarp',
    lengthM: 4.0,
    widthM: 4.4,
    heightM: 2.4,
    color: '#D4C5A9', // 아이보리 탄
  },
  {
    type: 'hexa_tarp',
    name: '헥사(육각) 타프',
    category: 'tarp',
    lengthM: 4.4,
    widthM: 4.0,
    heightM: 2.3,
    color: '#8D6E63', // 모카 브라운
  },
];

export default function SitePlacementEditor({
  site,
  onUpdateSite,
  placedGears,
  onUpdateGears,
  onStartSimulation,
  onBackToEntry,
}: SitePlacementEditorProps) {
  // 선택된 활성 오브젝트 (장비 id 또는 장애물 index)
  const [selectedGearId, setSelectedGearId] = useState<string | null>(
    placedGears.length > 0 ? placedGears[0].id : null
  );
  const [selectedObstacleIdx, setSelectedObstacleIdx] = useState<number | null>(null);

  // 사이트 크기 (가로 W × 세로 D)
  const [widthM, setWidthM] = useState<number>(site.widthM || 8);
  const [depthM, setDepthM] = useState<number>(site.depthM || 7);

  // 장비 추가 모달 시트 상태
  const [isAddGearModalOpen, setIsAddGearModalOpen] = useState<boolean>(false);
  const [selectedPreset, setSelectedPreset] = useState<GearPreset>(PRESET_GEARS[0]);
  const [customLengthM, setCustomLengthM] = useState<number>(PRESET_GEARS[0].lengthM);
  const [customWidthM, setCustomWidthM] = useState<number>(PRESET_GEARS[0].widthM);

  // 2D 캔버스 드래그 처리를 위한 상태
  const canvasRef = useRef<HTMLDivElement>(null);
  const draggingItemRef = useRef<{
    type: 'gear' | 'obstacle';
    idOrIdx: string | number;
    startPointerX: number;
    startPointerY: number;
    startX: number;
    startZ: number;
  } | null>(null);

  // 화면 스케일: 1미터당 24픽셀
  const PIXELS_PER_METER = 24;

  // 사이트 치수 변경
  const handleApplyDimensions = (newW: number, newD: number) => {
    const validW = Math.max(3, Math.min(25, newW));
    const validD = Math.max(3, Math.min(25, newD));
    setWidthM(validW);
    setDepthM(validD);
    onUpdateSite({
      ...site,
      widthM: validW,
      depthM: validD,
    });
  };

  // 1. 프리셋 선택 시 커스텀 크기 동기화
  const handleSelectPreset = (preset: GearPreset) => {
    setSelectedPreset(preset);
    setCustomLengthM(preset.lengthM);
    setCustomWidthM(preset.widthM);
  };

  // 2. 새 장비 추가 실행 (겹침 방지 오프셋 적용)
  const handleConfirmAddGear = () => {
    const newId = `gear_${Date.now()}`;
    // 기존 장비들과 겹치지 않도록 순차적 오프셋 계산
    const offsetCount = placedGears.length;
    const offsetX = offsetCount === 0 ? 0 : (offsetCount % 2 === 1 ? 1.5 : -1.5);
    const offsetZ = offsetCount === 0 ? 0 : (Math.floor(offsetCount / 2) * 1.2);

    const newGear: PlacedGearItem = {
      id: newId,
      type: selectedPreset.type,
      name: `${selectedPreset.name} #${offsetCount + 1}`,
      lengthM: customLengthM,
      widthM: customWidthM,
      heightM: selectedPreset.heightM,
      color: selectedPreset.color,
      x: Math.max(-widthM / 2 + 1, Math.min(widthM / 2 - 1, offsetX)),
      z: Math.max(-depthM / 2 + 1, Math.min(depthM / 2 - 1, offsetZ)),
      rotationDeg: site.bearingDeg || 135,
    };

    const nextGears = [...placedGears, newGear];
    onUpdateGears(nextGears);
    setSelectedGearId(newId);
    setSelectedObstacleIdx(null);
    setIsAddGearModalOpen(false);

    toast.success(`${newGear.name} (${customLengthM}×${customWidthM}m) 배치 완료!`, {
      description: '장비를 손가락으로 드래그하여 원하는 위치로 이동하세요.',
    });
  };

  // 3. 장애물 추가 핸들러 (나무 / 배전반 / 차량)
  const handleAddObstacle = (type: 'tree' | 'post' | 'car') => {
    const newObs: SiteObstacle = {
      type,
      x: (Math.random() - 0.5) * (widthM * 0.6),
      y: (Math.random() - 0.5) * (depthM * 0.6),
      height: type === 'tree' ? 6.5 : type === 'post' ? 1.2 : 1.8,
      radius: type === 'tree' ? 1.8 : 0.4,
      width: type === 'car' ? 1.9 : undefined,
      length: type === 'car' ? 4.8 : undefined,
    };

    const currentObs = site.obstacles || [];
    onUpdateSite({
      ...site,
      obstacles: [...currentObs, newObs],
    });
    setSelectedObstacleIdx(currentObs.length);
    setSelectedGearId(null);
    toast.info(`${type === 'tree' ? '나무' : type === 'post' ? '배전반' : '차량'}가 사이트에 추가되었습니다.`);
  };

  // 4. 선택된 장비 삭제 핸들러
  const handleDeleteSelectedGear = () => {
    if (selectedGearId) {
      const remaining = placedGears.filter((g) => g.id !== selectedGearId);
      onUpdateGears(remaining);
      setSelectedGearId(remaining.length > 0 ? remaining[0].id : null);
      toast.success('선택한 장비를 삭제했습니다.');
    }
  };

  // 5. 선택된 장애물 삭제 핸들러
  const handleDeleteSelectedObstacle = () => {
    if (selectedObstacleIdx !== null && site.obstacles) {
      const remaining = site.obstacles.filter((_, idx) => idx !== selectedObstacleIdx);
      onUpdateSite({ ...site, obstacles: remaining });
      setSelectedObstacleIdx(null);
      toast.success('선택한 장애물을 삭제했습니다.');
    }
  };

  // 6. 선택된 장비 회전 핸들러
  const handleRotateSelectedGear = (deltaDeg: number) => {
    if (!selectedGearId) return;
    onUpdateGears(
      placedGears.map((g) => {
        if (g.id === selectedGearId) {
          return {
            ...g,
            rotationDeg: (g.rotationDeg + deltaDeg + 360) % 360,
          };
        }
        return g;
      })
    );
  };

  // 7. 터치/마우스 드래그 이동 핸들러 (Pointer Events)
  const handlePointerDownGear = (e: React.PointerEvent, gear: PlacedGearItem) => {
    e.stopPropagation();
    setSelectedGearId(gear.id);
    setSelectedObstacleIdx(null);

    draggingItemRef.current = {
      type: 'gear',
      idOrIdx: gear.id,
      startPointerX: e.clientX,
      startPointerY: e.clientY,
      startX: gear.x,
      startZ: gear.z,
    };

    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerDownObstacle = (e: React.PointerEvent, idx: number, obs: SiteObstacle) => {
    e.stopPropagation();
    setSelectedObstacleIdx(idx);
    setSelectedGearId(null);

    draggingItemRef.current = {
      type: 'obstacle',
      idOrIdx: idx,
      startPointerX: e.clientX,
      startPointerY: e.clientY,
      startX: obs.x,
      startZ: obs.y,
    };

    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!draggingItemRef.current) return;

    const deltaX = (e.clientX - draggingItemRef.current.startPointerX) / PIXELS_PER_METER;
    const deltaZ = (e.clientY - draggingItemRef.current.startPointerY) / PIXELS_PER_METER;

    const maxLimitX = widthM / 2 - 0.5;
    const maxLimitZ = depthM / 2 - 0.5;

    if (draggingItemRef.current.type === 'gear') {
      const gearId = draggingItemRef.current.idOrIdx as string;
      const newX = Math.max(-maxLimitX, Math.min(maxLimitX, draggingItemRef.current.startX + deltaX));
      const newZ = Math.max(-maxLimitZ, Math.min(maxLimitZ, draggingItemRef.current.startZ + deltaZ));

      onUpdateGears(
        placedGears.map((g) => (g.id === gearId ? { ...g, x: newX, z: newZ } : g))
      );
    } else if (draggingItemRef.current.type === 'obstacle') {
      const obsIdx = draggingItemRef.current.idOrIdx as number;
      const newX = Math.max(-maxLimitX, Math.min(maxLimitX, draggingItemRef.current.startX + deltaX));
      const newY = Math.max(-maxLimitZ, Math.min(maxLimitZ, draggingItemRef.current.startZ + deltaZ));

      if (site.obstacles) {
        const nextObs = [...site.obstacles];
        nextObs[obsIdx] = { ...nextObs[obsIdx], x: newX, y: newY };
        onUpdateSite({ ...site, obstacles: nextObs });
      }
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (draggingItemRef.current) {
      try {
        (e.target as HTMLElement).releasePointerCapture(e.pointerId);
      } catch (err) {
        // 이미 해제된 경우 무시
      }
      draggingItemRef.current = null;
    }
  };

  // 8. 시뮬레이션 가동 전 검증
  const handleProceedToSimulation = () => {
    if (placedGears.length === 0) {
      toast.error('최소 1개 이상의 텐트나 타프를 추가해야 시뮬레이션을 가동할 수 있습니다.', {
        description: '하단의 [+ 텐트 / 타프 추가] 버튼을 눌러 장비를 추가해주세요.',
      });
      return;
    }
    onStartSimulation();
  };

  const activeGear = placedGears.find((g) => g.id === selectedGearId);

  return (
    <div
      className="flex flex-col h-[100dvh] w-full bg-[#121E15] text-stone-100 overflow-hidden select-none"
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      {/* 1. 상단 미니 헤더 */}
      <header className="flex items-center justify-between px-3 sm:px-4 py-2.5 bg-[#1C3B29] border-b border-[#2A553C] shrink-0 z-30 shadow-md">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onBackToEntry}
            className="p-1.5 rounded-full text-emerald-200 hover:text-white hover:bg-emerald-800/40 transition-colors"
            title="위치 다시 찍기"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div>
            <h2 className="text-xs sm:text-sm font-bold text-white flex items-center gap-1.5 leading-tight">
              <span>Step 2. 사이트 & 장비 배치</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-800 text-emerald-200 font-semibold border border-emerald-500/30">
                2D 에디터
              </span>
            </h2>
            <p className="text-[11px] text-emerald-200/80 truncate max-w-[200px] sm:max-w-xs">
              {site.locationType === 'campground'
                ? `🏕️ ${site.campgroundName || '라온아이'} · ${site.siteName || site.name}`
                : `📍 ${site.address || site.name}`}
            </p>
          </div>
        </div>

        {/* 3D 가동 버튼 */}
        <button
          type="button"
          onClick={handleProceedToSimulation}
          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs shadow-lg transition-all active:scale-95 cursor-pointer"
        >
          <Play className="w-3.5 h-3.5 fill-white" />
          <span>3D 시뮬레이션 가동</span>
        </button>
      </header>

      {/* 2. 상단 사이트 크기 & 현황 인포바 (모바일에서 절대 잘리지 않음) */}
      <div className="bg-[#162E20] px-3.5 py-2 border-b border-[#244A34] flex items-center justify-between shrink-0 z-20">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-bold text-emerald-300 flex items-center gap-1">
            <Maximize2 className="w-3.5 h-3.5 text-amber-300" />
            <span>사이트 규격:</span>
          </span>
          <div className="flex items-center gap-1 bg-[#102217] px-2 py-0.5 rounded-lg border border-emerald-600/40">
            <input
              type="number"
              value={widthM}
              onChange={(e) => handleApplyDimensions(Number(e.target.value), depthM)}
              className="w-10 px-1 py-0.5 text-xs text-center font-bold bg-transparent text-white"
              min={3}
              max={25}
            />
            <span className="text-xs text-stone-400 font-semibold">×</span>
            <input
              type="number"
              value={depthM}
              onChange={(e) => handleApplyDimensions(widthM, Number(e.target.value))}
              className="w-10 px-1 py-0.5 text-xs text-center font-bold bg-transparent text-white"
              min={3}
              max={25}
            />
            <span className="text-xs text-emerald-300 font-semibold">m</span>
          </div>
        </div>

        <div className="text-[11px] text-emerald-200/90 font-medium">
          배치 장비: <strong className="text-amber-300 font-bold">{placedGears.length}</strong>동
        </div>
      </div>

      {/* 3. 메인 2D 위성/그리드 배치 작업대 */}
      <div
        className="relative flex-1 w-full bg-[#0E1A11] overflow-hidden flex items-center justify-center p-4 cursor-default"
        onClick={() => {
          setSelectedGearId(null);
          setSelectedObstacleIdx(null);
        }}
      >
        {/* 사이트 영역 사각틀 */}
        <div
          ref={canvasRef}
          className="relative bg-[#203627] border-2 border-emerald-400/90 rounded-2xl shadow-2xl overflow-visible flex items-center justify-center transition-all"
          style={{
            width: widthM * PIXELS_PER_METER,
            height: depthM * PIXELS_PER_METER,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* 사이트 파쇄석 그리드 패턴 */}
          <div
            className="absolute inset-0 opacity-25 pointer-events-none rounded-2xl"
            style={{
              backgroundImage: 'radial-gradient(#A7F3D0 1.2px, transparent 1.2px)',
              backgroundSize: '16px 16px',
            }}
          />

          {/* 사이트 진입 전면 표시 라벨 (화살표) */}
          <div className="absolute top-2 left-1/2 -translate-x-1/2 flex items-center gap-1 text-[10px] font-bold text-emerald-300 bg-emerald-950/90 px-2.5 py-0.5 rounded-full border border-emerald-500/40 pointer-events-none shadow-md">
            <ArrowUp className="w-3 h-3 text-emerald-300" />
            <span>진입로 (앞쪽)</span>
          </div>

          {/* 치수 표시 배지 */}
          <span className="absolute bottom-1 right-2 text-[10px] text-emerald-200/60 font-mono pointer-events-none">
            {widthM}m × {depthM}m
          </span>

          {/* 빈 사이트일 때 안내 문구 */}
          {placedGears.length === 0 && (
            <div className="flex flex-col items-center justify-center p-4 text-center pointer-events-none animate-pulse">
              <Tent className="w-10 h-10 text-emerald-400/60 mb-2" />
              <p className="text-xs font-bold text-white drop-shadow">사이트가 비어 있습니다</p>
              <p className="text-[11px] text-emerald-300/80 mt-0.5">
                아래 [+ 텐트 / 타프 추가] 버튼을 눌러 장비를 올려놓으세요 ⛺
              </p>
            </div>
          )}

          {/* 1) 배치된 텐트 / 타프 장비들 렌더링 */}
          {placedGears.map((gear) => {
            const isSelected = gear.id === selectedGearId;
            const itemW = gear.widthM * PIXELS_PER_METER;
            const itemL = gear.lengthM * PIXELS_PER_METER;
            const isTarp = gear.type.includes('tarp');

            return (
              <div
                key={gear.id}
                onPointerDown={(e) => handlePointerDownGear(e, gear)}
                className={`absolute cursor-grab active:cursor-grabbing select-none transition-shadow touch-none ${
                  isTarp ? 'rounded-lg' : 'rounded-2xl'
                } border-2 ${
                  isSelected
                    ? 'border-amber-400 ring-4 ring-amber-400/40 shadow-2xl z-20'
                    : 'border-white/70 shadow-md z-10'
                }`}
                style={{
                  width: itemW,
                  height: itemL,
                  left: `calc(50% + ${gear.x * PIXELS_PER_METER}px - ${itemW / 2}px)`,
                  top: `calc(50% + ${gear.z * PIXELS_PER_METER}px - ${itemL / 2}px)`,
                  transform: `rotate(${gear.rotationDeg}deg)`,
                  backgroundColor: gear.color,
                }}
              >
                {/* 텐트 내부 라벨 & 방향 지시자 */}
                <div className="w-full h-full flex flex-col items-center justify-between p-1.5 text-center pointer-events-none">
                  <div className="w-2.5 h-2.5 rounded-full bg-white shadow-sm" />
                  <div>
                    <p className="text-[11px] font-extrabold text-white drop-shadow leading-tight truncate max-w-[120px]">
                      {gear.name}
                    </p>
                    <p className="text-[9.5px] text-white/90 font-mono drop-shadow">
                      {gear.lengthM}m × {gear.widthM}m
                    </p>
                  </div>
                  <span className="text-[9px] font-bold text-amber-200 bg-black/50 px-1 rounded">
                    {Math.round(gear.rotationDeg)}°
                  </span>
                </div>
              </div>
            );
          })}

          {/* 2) 배치된 장애물 (나무, 배전반, 차량) 렌더링 */}
          {(site.obstacles || []).map((obs, idx) => {
            const isSelected = idx === selectedObstacleIdx;
            const obsSize = obs.type === 'tree' ? 36 : obs.type === 'post' ? 24 : 44;

            return (
              <div
                key={idx}
                onPointerDown={(e) => handlePointerDownObstacle(e, idx, obs)}
                className={`absolute cursor-grab active:cursor-grabbing flex items-center justify-center rounded-full border-2 transition-all touch-none select-none ${
                  isSelected
                    ? 'border-amber-400 ring-2 ring-amber-400/40 scale-110 z-20'
                    : 'border-white/50 z-10'
                }`}
                style={{
                  width: obsSize,
                  height: obsSize,
                  left: `calc(50% + ${obs.x * PIXELS_PER_METER}px - ${obsSize / 2}px)`,
                  top: `calc(50% + ${obs.y * PIXELS_PER_METER}px - ${obsSize / 2}px)`,
                  backgroundColor:
                    obs.type === 'tree'
                      ? '#2E7D32'
                      : obs.type === 'post'
                      ? '#E65100'
                      : '#37474F',
                }}
                title={obs.type === 'tree' ? '나무' : obs.type === 'post' ? '배전반' : '차량'}
              >
                {obs.type === 'tree' && <TreePine className="w-4 h-4 text-emerald-200 pointer-events-none" />}
                {obs.type === 'post' && <Zap className="w-3.5 h-3.5 text-amber-200 pointer-events-none" />}
                {obs.type === 'car' && <Car className="w-4 h-4 text-stone-200 pointer-events-none" />}
              </div>
            );
          })}
        </div>

        {/* 선택된 오브젝트 액션 툴바 (회전 및 삭제) */}
        {(selectedGearId || selectedObstacleIdx !== null) && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-[#1C3B29]/95 backdrop-blur-md px-3.5 py-2 rounded-2xl border border-emerald-500/40 shadow-2xl flex items-center gap-2 z-30 animate-in fade-in zoom-in-95 duration-150">
            {selectedGearId && activeGear && (
              <>
                <span className="text-xs font-bold text-white shrink-0 truncate max-w-[110px]">
                  {activeGear.name}
                </span>
                <div className="h-4 w-px bg-emerald-600/50" />
                <button
                  type="button"
                  onClick={() => handleRotateSelectedGear(-15)}
                  className="px-2 py-1 text-xs font-bold rounded-lg bg-[#12271B] text-stone-200 hover:text-white flex items-center gap-0.5 active:scale-95"
                  title="반시계 15도 회전"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>-15°</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleRotateSelectedGear(15)}
                  className="px-2 py-1 text-xs font-bold rounded-lg bg-[#12271B] text-stone-200 hover:text-white flex items-center gap-0.5 active:scale-95"
                  title="시계 15도 회전"
                >
                  <span>+15°</span>
                  <RotateCw className="w-3 h-3" />
                </button>
                <button
                  type="button"
                  onClick={handleDeleteSelectedGear}
                  className="flex items-center gap-1 px-2.5 py-1 text-xs font-bold rounded-lg bg-red-600 hover:bg-red-500 text-white shadow active:scale-95 transition-all"
                  title="이 장비 삭제"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>삭제</span>
                </button>
              </>
            )}

            {selectedObstacleIdx !== null && (
              <>
                <span className="text-xs font-bold text-white shrink-0">
                  장애물 ({site.obstacles?.[selectedObstacleIdx]?.type === 'tree' ? '나무' : site.obstacles?.[selectedObstacleIdx]?.type === 'post' ? '배전반' : '차량'})
                </span>
                <button
                  type="button"
                  onClick={handleDeleteSelectedObstacle}
                  className="flex items-center gap-1 px-2.5 py-1 text-xs font-bold rounded-lg bg-red-600 hover:bg-red-500 text-white shadow active:scale-95 transition-all"
                  title="장애물 삭제"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>삭제</span>
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {/* 4. 하단 장비 및 장애물 추가 툴바 (모바일 safe-area 완벽 대응) */}
      <footer className="p-3 sm:p-4 bg-[#1C3B29] border-t border-[#2A553C] space-y-2.5 shrink-0 z-20 pb-safe shadow-2xl">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-emerald-300 flex items-center gap-1.5">
            <Plus className="w-4 h-4 text-emerald-400" />
            <span>장비 및 현장 장애물 추가</span>
          </span>
          <span className="text-[10px] text-emerald-200/70">
            손가락으로 드래그하여 배치
          </span>
        </div>

        {/* 장비/장애물 버튼 리스트 */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          {/* 메인 텐트 / 타프 추가 모달 열기 버튼 */}
          <button
            type="button"
            onClick={() => setIsAddGearModalOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold shrink-0 shadow-md active:scale-95 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>+ 텐트 / 타프 추가</span>
          </button>

          <div className="h-6 w-px bg-emerald-700/60 shrink-0" />

          {/* 현장 장애물 빠른 추가 버튼들 */}
          <button
            type="button"
            onClick={() => handleAddObstacle('tree')}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#142C1E] hover:bg-[#1B3B28] text-emerald-200 text-xs font-semibold shrink-0 border border-emerald-600/30 active:scale-95"
          >
            <TreePine className="w-3.5 h-3.5 text-emerald-400" />
            <span>+ 나무</span>
          </button>
          <button
            type="button"
            onClick={() => handleAddObstacle('post')}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#142C1E] hover:bg-[#1B3B28] text-amber-200 text-xs font-semibold shrink-0 border border-amber-600/30 active:scale-95"
          >
            <Zap className="w-3.5 h-3.5 text-amber-400" />
            <span>+ 배전반</span>
          </button>
          <button
            type="button"
            onClick={() => handleAddObstacle('car')}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#142C1E] hover:bg-[#1B3B28] text-stone-300 text-xs font-semibold shrink-0 border border-stone-600/30 active:scale-95"
          >
            <Car className="w-3.5 h-3.5 text-stone-300" />
            <span>+ 차량</span>
          </button>
        </div>
      </footer>

      {/* 5. 텐트 / 타프 추가 규격 선택 모달 바텀시트 */}
      {isAddGearModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
          <div className="bg-[#1C3B29] border border-emerald-500/40 w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl p-5 shadow-2xl text-stone-100 space-y-4">
            <div className="flex items-center justify-between border-b border-emerald-700/40 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Tent className="w-4 h-4 text-emerald-300" />
                <span>텐트 / 타프 추가하기</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsAddGearModalOpen(false)}
                className="p-1 rounded-full text-stone-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* 프리셋 선택 그리드 */}
            <div>
              <label className="text-xs font-bold text-emerald-300 mb-2 block">
                장비 종류 선택
              </label>
              <div className="grid grid-cols-2 gap-2">
                {PRESET_GEARS.map((preset) => {
                  const isSelected = selectedPreset.name === preset.name;
                  return (
                    <button
                      key={preset.name}
                      type="button"
                      onClick={() => handleSelectPreset(preset)}
                      className={`p-2.5 rounded-xl text-left border transition-all ${
                        isSelected
                          ? 'bg-emerald-700/60 border-emerald-400 ring-2 ring-emerald-400/40'
                          : 'bg-[#12271B] border-emerald-700/40 hover:bg-[#193625]'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-white">{preset.name}</span>
                        <div
                          className="w-3 h-3 rounded-full border border-white/40"
                          style={{ backgroundColor: preset.color }}
                        />
                      </div>
                      <p className="text-[10px] text-stone-300 font-mono mt-1">
                        기본 {preset.lengthM} × {preset.widthM}m
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 크기 직접 입력 */}
            <div className="bg-[#12271B] p-3 rounded-xl border border-emerald-600/40 space-y-2">
              <span className="text-xs font-bold text-emerald-300 block">
                내 텐트 실측 크기 (m)
              </span>
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <label className="text-[10px] text-stone-300 block mb-1">길이 (Length)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={customLengthM}
                    onChange={(e) => setCustomLengthM(Math.max(1, Math.min(15, Number(e.target.value))))}
                    className="w-full px-2 py-1.5 text-xs text-center font-bold bg-[#1C3B29] border border-emerald-500/50 rounded-lg text-white"
                  />
                </div>
                <span className="text-sm font-bold text-stone-400 mt-4">×</span>
                <div className="flex-1">
                  <label className="text-[10px] text-stone-300 block mb-1">폭 (Width)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={customWidthM}
                    onChange={(e) => setCustomWidthM(Math.max(1, Math.min(15, Number(e.target.value))))}
                    className="w-full px-2 py-1.5 text-xs text-center font-bold bg-[#1C3B29] border border-emerald-500/50 rounded-lg text-white"
                  />
                </div>
              </div>
            </div>

            {/* 확인 버튼 */}
            <button
              type="button"
              onClick={handleConfirmAddGear}
              className="w-full py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs shadow-lg active:scale-[0.99] transition-all cursor-pointer"
            >
              이 장비 추가하기
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
