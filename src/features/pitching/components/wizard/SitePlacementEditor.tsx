'use client';

import React, { useState, useRef } from 'react';
import {
  Tent,
  Trash2,
  RotateCw,
  Plus,
  Play,
  ArrowUp,
  Maximize2,
  TreePine,
  Zap,
  Car,
  ShieldAlert,
  Sliders,
  Layers,
  ChevronLeft,
} from 'lucide-react';
import type { SiteGeometry, PlacedGearItem, PlacedGearType, SiteObstacle } from '../../types';

interface SitePlacementEditorProps {
  site: SiteGeometry;
  onUpdateSite: (updated: SiteGeometry) => void;
  placedGears: PlacedGearItem[];
  onUpdateGears: (gears: PlacedGearItem[]) => void;
  onStartSimulation: () => void;
  onBackToEntry: () => void;
}

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
  const [isPolygonMode, setIsPolygonMode] = useState<boolean>(false);

  // 다각형 4개 모서리 오프셋 (비정형 사이트용: [x, z] 미터)
  const [polyCorners, setPolyCorners] = useState<[number, number][]>([
    [-widthM / 2, -depthM / 2],
    [widthM / 2, -depthM / 2],
    [widthM / 2, depthM / 2],
    [-widthM / 2, depthM / 2],
  ]);

  // 2D 캔버스 드래그 처리를 위한 상태
  const canvasRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);

  // 화면 스케일: 1미터당 24픽셀
  const PIXELS_PER_METER = 24;
  const canvasW = Math.max(300, (widthM + 4) * PIXELS_PER_METER);
  const canvasH = Math.max(300, (depthM + 4) * PIXELS_PER_METER);

  // 1. 새 텐트 추가 핸들러
  const handleAddTent = (shape: 'tunnel' | 'dome' | 'livingshell') => {
    const newId = `tent_${Date.now()}`;
    let gearItem: PlacedGearItem;

    if (shape === 'tunnel') {
      gearItem = {
        id: newId,
        type: 'tunnel_tent',
        name: `터널형 텐트 #${placedGears.length + 1}`,
        lengthM: 6.2,
        widthM: 3.3,
        heightM: 2.1,
        color: '#4B5320', // 올리브 카키
        x: 0,
        z: 0,
        rotationDeg: site.bearingDeg || 135,
      };
    } else if (shape === 'dome') {
      gearItem = {
        id: newId,
        type: 'dome_tent',
        name: `돔 텐트 #${placedGears.length + 1}`,
        lengthM: 3.2,
        widthM: 3.2,
        heightM: 1.8,
        color: '#C2B280', // 샌드 베이지
        x: (placedGears.length * 1.5) % (widthM / 2),
        z: 0,
        rotationDeg: site.bearingDeg || 135,
      };
    } else {
      gearItem = {
        id: newId,
        type: 'livingshell_tent',
        name: `리빙쉘 텐트 #${placedGears.length + 1}`,
        lengthM: 5.8,
        widthM: 3.6,
        heightM: 2.1,
        color: '#37474F', // 다크 차콜
        x: 0,
        z: 0,
        rotationDeg: site.bearingDeg || 135,
      };
    }

    onUpdateGears([...placedGears, gearItem]);
    setSelectedGearId(newId);
    setSelectedObstacleIdx(null);
  };

  // 2. 타프 추가 핸들러 (렉타/헥사)
  const handleAddTarp = (tarpType: 'recta' | 'hexa') => {
    const newId = `tarp_${Date.now()}`;
    const gearItem: PlacedGearItem = {
      id: newId,
      type: tarpType === 'recta' ? 'recta_tarp' : 'hexa_tarp',
      name: tarpType === 'recta' ? '렉타 타프' : '헥사 타프',
      lengthM: 4.0,
      widthM: 4.4,
      heightM: 2.4,
      color: '#D4C5A9', // 아이보리 탄
      x: 0,
      z: 1.5,
      rotationDeg: site.bearingDeg || 135,
    };

    onUpdateGears([...placedGears, gearItem]);
    setSelectedGearId(newId);
    setSelectedObstacleIdx(null);
  };

  // 3. 장애물 추가 핸들러 (나무 / 배전반 / 차량)
  const handleAddObstacle = (type: 'tree' | 'post' | 'car') => {
    const newObs: SiteObstacle = {
      type,
      x: (Math.random() - 0.5) * (widthM * 0.7),
      y: (Math.random() - 0.5) * (depthM * 0.7),
      height: type === 'tree' ? 6.5 : type === 'post' ? 1.2 : 1.8,
      radius: type === 'tree' ? 1.8 : 0.4,
      width: type === 'car' ? 1.9 : undefined,
      length: type === 'car' ? 4.8 : undefined,
    };

    onUpdateSite({
      ...site,
      obstacles: [...(site.obstacles || []), newObs],
    });
    setSelectedObstacleIdx((site.obstacles || []).length);
    setSelectedGearId(null);
  };

  // 4. 선택된 장비 삭제 핸들러 (대표님 요청!)
  const handleDeleteSelectedGear = () => {
    if (selectedGearId) {
      const remaining = placedGears.filter((g) => g.id !== selectedGearId);
      onUpdateGears(remaining);
      setSelectedGearId(remaining.length > 0 ? remaining[0].id : null);
    }
  };

  // 5. 선택된 장애물 삭제 핸들러
  const handleDeleteSelectedObstacle = () => {
    if (selectedObstacleIdx !== null && site.obstacles) {
      const remaining = site.obstacles.filter((_, idx) => idx !== selectedObstacleIdx);
      onUpdateSite({ ...site, obstacles: remaining });
      setSelectedObstacleIdx(null);
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

  // 7. 사이트 크기 변경 적용
  const handleApplyDimensions = (newW: number, newD: number) => {
    setWidthM(newW);
    setDepthM(newD);
    onUpdateSite({
      ...site,
      widthM: newW,
      depthM: newD,
    });
    setPolyCorners([
      [-newW / 2, -newD / 2],
      [newW / 2, -newD / 2],
      [newW / 2, newD / 2],
      [-newW / 2, newD / 2],
    ]);
  };

  const activeGear = placedGears.find((g) => g.id === selectedGearId);

  return (
    <div className="flex flex-col h-screen w-full bg-[#121E15] text-stone-100 overflow-hidden select-none">
      {/* 1. 상단 미니 헤더 */}
      <header className="flex items-center justify-between px-4 py-3 bg-[#1C3B29] border-b border-[#2A553C] shrink-0 z-20 shadow-md">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onBackToEntry}
            className="p-1 rounded-full text-emerald-200 hover:text-white hover:bg-emerald-800/40"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div>
            <h2 className="text-sm font-bold text-white flex items-center gap-1.5">
              <span>Step 2. 사이트 & 장비 배치</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-800 text-emerald-200 font-semibold border border-emerald-500/30">
                2D 에디터
              </span>
            </h2>
            <p className="text-[11px] text-emerald-200/80">
              {site.locationType === 'campground'
                ? `${site.campgroundName || '캠핑장'} · ${site.siteName || site.name}`
                : `${site.address || site.name}`} ({widthM}m × {depthM}m)
            </p>
          </div>
        </div>

        {/* 3D 가동 버튼 */}
        <button
          type="button"
          onClick={onStartSimulation}
          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-lg transition-all active:scale-95 cursor-pointer"
        >
          <Play className="w-3.5 h-3.5 fill-white" />
          <span>3D 시뮬레이션 가동</span>
        </button>
      </header>

      {/* 2. 메인 2D 위성/그리드 배치 작업대 */}
      <div className="relative flex-1 w-full bg-[#16291C] overflow-hidden flex items-center justify-center p-4">
        {/* 사이트 영역 사각틀 */}
        <div
          ref={canvasRef}
          className="relative bg-[#2D4533] border-2 border-emerald-400/80 rounded-xl shadow-2xl overflow-visible flex items-center justify-center"
          style={{
            width: widthM * PIXELS_PER_METER,
            height: depthM * PIXELS_PER_METER,
          }}
        >
          {/* 사이트 파쇄석 그리드 패턴 */}
          <div
            className="absolute inset-0 opacity-20 pointer-events-none"
            style={{
              backgroundImage: 'radial-gradient(#A7F3D0 1px, transparent 1px)',
              backgroundSize: '16px 16px',
            }}
          />

          {/* 사이트 진입 전면 표시 라벨 (화살표) */}
          <div className="absolute top-2 left-1/2 -translate-x-1/2 flex items-center gap-1 text-[10px] font-bold text-emerald-300 bg-emerald-950/80 px-2 py-0.5 rounded-full border border-emerald-500/40 pointer-events-none">
            <ArrowUp className="w-3 h-3 text-emerald-300" />
            <span>진입로 (앞쪽)</span>
          </div>

          {/* 치수 표시 배지 */}
          <span className="absolute bottom-1 right-2 text-[10px] text-emerald-200/60 font-mono pointer-events-none">
            {widthM}m × {depthM}m
          </span>

          {/* 1) 배치된 텐트 / 타프 장비들 렌더링 */}
          {placedGears.map((gear) => {
            const isSelected = gear.id === selectedGearId;
            const itemW = gear.widthM * PIXELS_PER_METER;
            const itemL = gear.lengthM * PIXELS_PER_METER;
            const isTarp = gear.type.includes('tarp');

            return (
              <div
                key={gear.id}
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedGearId(gear.id);
                  setSelectedObstacleIdx(null);
                }}
                className={`absolute cursor-move select-none transition-shadow ${
                  isTarp ? 'rounded-lg' : 'rounded-2xl'
                } border-2 ${
                  isSelected
                    ? 'border-amber-400 ring-4 ring-amber-400/30 shadow-2xl z-20'
                    : 'border-white/60 shadow-md z-10'
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
                  <div className="w-2 h-2 rounded-full bg-white/80" />
                  <div>
                    <p className="text-[11px] font-bold text-white drop-shadow-md leading-tight">
                      {gear.name}
                    </p>
                    <p className="text-[9px] text-white/80 font-mono">
                      {gear.lengthM}m × {gear.widthM}m
                    </p>
                  </div>
                  <span className="text-[9px] font-bold text-amber-200 bg-black/40 px-1 rounded">
                    {Math.round(gear.rotationDeg)}°
                  </span>
                </div>
              </div>
            );
          })}

          {/* 2) 배치된 장애물 (나무, 배전반, 차량) 렌더링 */}
          {(site.obstacles || []).map((obs, idx) => {
            const isSelected = idx === selectedObstacleIdx;
            const obsSize = obs.type === 'tree' ? 36 : obs.type === 'post' ? 22 : 44;

            return (
              <div
                key={idx}
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedObstacleIdx(idx);
                  setSelectedGearId(null);
                }}
                className={`absolute cursor-pointer flex items-center justify-center rounded-full border-2 transition-all ${
                  isSelected
                    ? 'border-amber-400 ring-2 ring-amber-400/40 scale-110 z-20'
                    : 'border-white/40 z-10'
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
                {obs.type === 'tree' && <TreePine className="w-4 h-4 text-emerald-200" />}
                {obs.type === 'post' && <Zap className="w-3.5 h-3.5 text-amber-200" />}
                {obs.type === 'car' && <Car className="w-4 h-4 text-stone-200" />}
              </div>
            );
          })}
        </div>

        {/* 선택된 오브젝트 액션 툴바 (회전 및 삭제) */}
        {(selectedGearId || selectedObstacleIdx !== null) && (
          <div className="absolute top-6 left-1/2 -translate-x-1/2 bg-[#1C3B29]/95 backdrop-blur-md px-3.5 py-2 rounded-2xl border border-emerald-500/40 shadow-xl flex items-center gap-2 z-30">
            {selectedGearId && activeGear && (
              <>
                <span className="text-xs font-bold text-white shrink-0">
                  {activeGear.name}
                </span>
                <div className="h-4 w-px bg-emerald-600/50" />
                <button
                  type="button"
                  onClick={() => handleRotateSelectedGear(-15)}
                  className="px-2 py-1 text-xs font-semibold rounded bg-[#12271B] text-stone-200 hover:text-white"
                  title="반시계 15도 회전"
                >
                  ↺ -15°
                </button>
                <button
                  type="button"
                  onClick={() => handleRotateSelectedGear(15)}
                  className="px-2 py-1 text-xs font-semibold rounded bg-[#12271B] text-stone-200 hover:text-white"
                  title="시계 15도 회전"
                >
                  +15° ↻
                </button>
                <button
                  type="button"
                  onClick={handleDeleteSelectedGear}
                  className="flex items-center gap-1 px-2.5 py-1 text-xs font-bold rounded bg-red-600/90 text-white hover:bg-red-500"
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
                  선택된 장애물
                </span>
                <button
                  type="button"
                  onClick={handleDeleteSelectedObstacle}
                  className="flex items-center gap-1 px-2.5 py-1 text-xs font-bold rounded bg-red-600/90 text-white hover:bg-red-500"
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

      {/* 3. 하단 장비 및 장애물 추가 툴바 */}
      <footer className="p-4 bg-[#1C3B29] border-t border-[#2A553C] space-y-3 shrink-0">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-emerald-300 flex items-center gap-1.5">
            <Layers className="w-4 h-4" />
            <span>장비 & 장애물 추가</span>
          </span>
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-stone-300">사이트 크기:</span>
            <input
              type="number"
              value={widthM}
              onChange={(e) => handleApplyDimensions(Number(e.target.value), depthM)}
              className="w-12 px-1.5 py-0.5 text-xs text-center bg-[#12271B] border border-emerald-600/40 rounded text-white"
              min={4}
              max={20}
            />
            <span className="text-xs text-stone-400">×</span>
            <input
              type="number"
              value={depthM}
              onChange={(e) => handleApplyDimensions(widthM, Number(e.target.value))}
              className="w-12 px-1.5 py-0.5 text-xs text-center bg-[#12271B] border border-emerald-600/40 rounded text-white"
              min={4}
              max={20}
            />
            <span className="text-xs text-stone-400">m</span>
          </div>
        </div>

        {/* 장비/장애물 버튼 리스트 */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          <button
            type="button"
            onClick={() => handleAddTent('tunnel')}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#254F37] hover:bg-[#2E6345] text-white text-xs font-semibold shrink-0 border border-emerald-500/30 active:scale-95"
          >
            <Plus className="w-3.5 h-3.5 text-emerald-300" />
            <span>+ 터널형 텐트</span>
          </button>
          <button
            type="button"
            onClick={() => handleAddTent('dome')}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#254F37] hover:bg-[#2E6345] text-white text-xs font-semibold shrink-0 border border-emerald-500/30 active:scale-95"
          >
            <Plus className="w-3.5 h-3.5 text-emerald-300" />
            <span>+ 돔 텐트</span>
          </button>
          <button
            type="button"
            onClick={() => handleAddTarp('recta')}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#2E553B] hover:bg-[#386847] text-amber-200 text-xs font-semibold shrink-0 border border-amber-500/30 active:scale-95"
          >
            <Plus className="w-3.5 h-3.5 text-amber-300" />
            <span>+ 렉타 타프</span>
          </button>
          <button
            type="button"
            onClick={() => handleAddTarp('hexa')}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#2E553B] hover:bg-[#386847] text-amber-200 text-xs font-semibold shrink-0 border border-amber-500/30 active:scale-95"
          >
            <Plus className="w-3.5 h-3.5 text-amber-300" />
            <span>+ 헥사 타프</span>
          </button>
          <button
            type="button"
            onClick={() => handleAddObstacle('tree')}
            className="flex items-center gap-1 px-2.5 py-2 rounded-xl bg-[#1B3624] text-emerald-200 text-xs shrink-0 border border-emerald-600/30"
          >
            <TreePine className="w-3.5 h-3.5" />
            <span>나무</span>
          </button>
          <button
            type="button"
            onClick={() => handleAddObstacle('post')}
            className="flex items-center gap-1 px-2.5 py-2 rounded-xl bg-[#1B3624] text-amber-200 text-xs shrink-0 border border-amber-600/30"
          >
            <Zap className="w-3.5 h-3.5" />
            <span>배전반</span>
          </button>
          <button
            type="button"
            onClick={() => handleAddObstacle('car')}
            className="flex items-center gap-1 px-2.5 py-2 rounded-xl bg-[#1B3624] text-stone-300 text-xs shrink-0 border border-stone-600/30"
          >
            <Car className="w-3.5 h-3.5" />
            <span>차량</span>
          </button>
        </div>
      </footer>
    </div>
  );
}
