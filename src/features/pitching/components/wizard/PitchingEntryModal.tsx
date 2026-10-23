'use client';

import React, { useState, useEffect } from 'react';
import {
  MapPin,
  Calendar,
  Compass,
  AlertCircle,
  ChevronRight,
  RefreshCw,
  X,
  Sparkles,
  Tent,
} from 'lucide-react';
import { createClient } from '@/lib/supabase-client';
import { toast } from 'sonner';

export interface PitchingEntrySelection {
  locationType: 'campground' | 'wild';
  name: string;
  campgroundName?: string;
  siteName?: string;
  address?: string;
  lat: number;
  lng: number;
  date: Date;
  isWeatherAvailable: boolean;
  widthM?: number;
  depthM?: number;
}

interface PitchingEntryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (selection: PitchingEntrySelection) => void;
}

export default function PitchingEntryModal({
  isOpen,
  onClose,
  onSelect,
}: PitchingEntryModalProps) {
  const [activeTab, setActiveTab] = useState<'CHOICE' | 'SCHEDULE_LIST'>('CHOICE');
  const [schedules, setSchedules] = useState<any[]>([]);
  const [isLoadingSchedules, setIsLoadingSchedules] = useState(false);
  const [isLocating, setIsLocating] = useState(false);

  // 내 여행 일정 목록 로드
  useEffect(() => {
    if (!isOpen || activeTab !== 'SCHEDULE_LIST') return;

    const loadUserSchedules = async () => {
      try {
        setIsLoadingSchedules(true);
        const supabase = createClient();
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          toast.error('로그인이 필요한 서비스입니다.');
          return;
        }

        const { data, error } = await supabase
          .from('user_schedules')
          .select('*')
          .eq('user_id', session.user.id)
          .neq('status', 'cancelled')
          .order('check_in', { ascending: false })
          .limit(10);

        if (error) throw error;
        setSchedules(data || []);
      } catch (err) {
        console.error('일정 로드 실패:', err);
        toast.error('일정을 불러오는 중 오류가 발생했습니다.');
      } finally {
        setIsLoadingSchedules(false);
      }
    };

    loadUserSchedules();
  }, [isOpen, activeTab]);

  if (!isOpen) return null;

  // 1. 현위치 바로 피칭하기 핸들러
  const handleCurrentGpsPitching = () => {
    if (!navigator.geolocation) {
      toast.error('현재 기기에서 GPS 위치 정보를 지원하지 않습니다.');
      return;
    }

    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setIsLocating(false);
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;

        onSelect({
          locationType: 'wild',
          name: '현위치 노지 피칭',
          address: '현재 GPS 위치 (노지/자연)',
          lat,
          lng,
          date: new Date(),
          isWeatherAvailable: true,
          widthM: 8,
          depthM: 7,
        });
      },
      (err) => {
        setIsLocating(false);
        console.warn('GPS 획득 실패, 기본 철수네 좌표로 대체:', err);
        toast.info('GPS를 찾을 수 없어 라온아이 철수네를 기본 위치로 시작합니다.');
        onSelect({
          locationType: 'wild',
          name: '현위치 노지 피칭 (기본)',
          address: '충남 예산군 신암면 추사고택로 (라온아이 일대)',
          lat: 36.6354349,
          lng: 126.7638091,
          date: new Date(),
          isWeatherAvailable: true,
          widthM: 8,
          depthM: 7,
        });
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  // 2. 여행 일정 선택 핸들러
  const handleSelectSchedule = (item: any) => {
    const today = new Date();
    const checkInDate = item.check_in ? new Date(item.check_in) : new Date();
    const diffDays = Math.ceil((checkInDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    // 기상청 단기예보 범위 (3~5일 이내) 여부 확인
    const isWeatherAvailable = diffDays >= 0 && diffDays <= 4;

    if (!isWeatherAvailable && diffDays > 4) {
      toast.info(
        '해당 일정은 날씨 예보 기간(3~5일) 이전이므로, 맑은 날 기준의 일조·산그늘 분석으로 시뮬레이션을 가동합니다.',
        { duration: 4500 }
      );
    }

    onSelect({
      locationType: 'campground',
      name: `${item.title || item.place_name || '캠핑장'} · ${item.site_name || '사이트'}`,
      campgroundName: item.title || item.place_name || '라온아이 캠핑장',
      siteName: item.site_name || '철수네 (Site 1)',
      address: item.address || '충남 예산군 신암면 추사고택로 40-10',
      lat: item.lat || 36.6354349,
      lng: item.lng || 126.7638091,
      date: checkInDate,
      isWeatherAvailable,
      widthM: 8,
      depthM: 7,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/65 backdrop-blur-sm p-0 sm:p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-[#1B3524] border border-emerald-500/35 rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* 모달 상단 헤더 */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-emerald-600/25 bg-[#142B1D]">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center border border-emerald-400/30">
              <Tent className="w-4 h-4 text-emerald-300" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                <span>3D 피칭 시뮬레이터 시작</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-800 text-emerald-200 font-semibold border border-emerald-500/30">
                  P0
                </span>
              </h3>
              <p className="text-[11px] text-emerald-200/80">피칭할 위치와 일정을 선택해주세요</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-full text-stone-300 hover:text-white hover:bg-emerald-800/40"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 모달 본문 콘텐츠 */}
        <div className="p-5 overflow-y-auto space-y-4">
          {activeTab === 'CHOICE' ? (
            <div className="space-y-3">
              {/* 트랙 1: 현위치 바로 피칭하기 */}
              <button
                type="button"
                onClick={handleCurrentGpsPitching}
                disabled={isLocating}
                className="w-full flex items-center justify-between p-4 rounded-2xl bg-gradient-to-r from-[#234C32] to-[#1C3E29] border-2 border-emerald-500/50 hover:border-emerald-400 shadow-lg text-left group active:scale-[0.98] transition-all cursor-pointer"
              >
                <div className="flex items-center gap-3.5">
                  <div className="w-11 h-11 rounded-2xl bg-emerald-500/20 flex items-center justify-center text-emerald-300 border border-emerald-400/40 group-hover:scale-105 transition-transform">
                    {isLocating ? (
                      <RefreshCw className="w-5 h-5 animate-spin text-emerald-300" />
                    ) : (
                      <MapPin className="w-6 h-6 text-emerald-300" />
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-base font-bold text-white">현위치 바로 피칭하기</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-800 text-emerald-200 font-semibold">
                        실시간 GPS
                      </span>
                    </div>
                    <p className="text-xs text-emerald-200/80 mt-0.5">
                      지금 서 있는 캠핑장/노지 위치에서 즉시 3D 시뮬레이션
                    </p>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-emerald-400 group-hover:translate-x-1 transition-transform shrink-0" />
              </button>

              {/* 트랙 2: 내 여행일정 피칭하기 */}
              <button
                type="button"
                onClick={() => setActiveTab('SCHEDULE_LIST')}
                className="w-full flex items-center justify-between p-4 rounded-2xl bg-[#172E20] border-2 border-emerald-600/35 hover:border-emerald-500 shadow-md text-left group active:scale-[0.98] transition-all cursor-pointer"
              >
                <div className="flex items-center gap-3.5">
                  <div className="w-11 h-11 rounded-2xl bg-amber-500/20 flex items-center justify-center text-amber-300 border border-amber-400/30 group-hover:scale-105 transition-transform">
                    <Calendar className="w-6 h-6 text-amber-300" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-base font-bold text-white">내 여행일정 피칭하기</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-900/60 text-amber-200 font-semibold border border-amber-500/30">
                        저장된 일정
                      </span>
                    </div>
                    <p className="text-xs text-stone-300 mt-0.5">
                      예약해 둔 캠핑장의 날짜·좌표를 불러와 맞춤 피칭
                    </p>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-emerald-400 group-hover:translate-x-1 transition-transform shrink-0" />
              </button>

              {/* 하단 기본 철수네 바로가기 숏컷 */}
              <div className="pt-2 text-center">
                <button
                  type="button"
                  onClick={() =>
                    onSelect({
                      locationType: 'campground',
                      name: '라온아이 캠핑장 · 철수네 (Site 1)',
                      campgroundName: '라온아이 캠핑장',
                      siteName: '철수네 (Site 1)',
                      address: '충남 예산군 신암면 추사고택로 40-10',
                      lat: 36.6354349,
                      lng: 126.7638091,
                      date: new Date(),
                      isWeatherAvailable: true,
                      widthM: 8,
                      depthM: 7,
                    })
                  }
                  className="text-xs text-emerald-300/80 hover:text-emerald-200 underline underline-offset-4 py-1"
                >
                  기본 샘플 (라온아이 철수네 8×7m)로 바로 보기
                </button>
              </div>
            </div>
          ) : (
            /* 일정 리스트 목록 */
            <div className="space-y-3">
              <div className="flex items-center justify-between pb-1">
                <button
                  type="button"
                  onClick={() => setActiveTab('CHOICE')}
                  className="text-xs text-emerald-300 hover:underline flex items-center gap-1"
                >
                  ← 진입 방식 다시 선택
                </button>
                <span className="text-xs text-stone-400">최근 일정 목록</span>
              </div>

              {isLoadingSchedules ? (
                <div className="flex flex-col items-center justify-center py-8 space-y-2">
                  <RefreshCw className="w-6 h-6 text-emerald-400 animate-spin" />
                  <p className="text-xs text-stone-300">내 일정을 불러오는 중...</p>
                </div>
              ) : schedules.length === 0 ? (
                <div className="p-6 text-center bg-[#142B1D] rounded-2xl border border-emerald-600/30 space-y-2">
                  <AlertCircle className="w-6 h-6 text-amber-300 mx-auto" />
                  <p className="text-xs font-semibold text-white">등록된 여행 일정이 없습니다.</p>
                  <p className="text-[11px] text-stone-300">
                    '현위치 바로 피칭하기'를 이용하거나 기본 샘플로 시뮬레이션할 수 있습니다.
                  </p>
                  <button
                    type="button"
                    onClick={() => setActiveTab('CHOICE')}
                    className="mt-2 px-3 py-1.5 text-xs font-bold rounded-xl bg-emerald-700 text-white"
                  >
                    이전으로
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  {schedules.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleSelectSchedule(item)}
                      className="w-full flex items-center justify-between p-3.5 rounded-2xl bg-[#142B1D] hover:bg-[#1E3F2A] border border-emerald-600/30 text-left transition-all active:scale-[0.98] group"
                    >
                      <div>
                        <p className="text-sm font-bold text-white group-hover:text-emerald-200">
                          {item.title || item.place_name || '캠핑장 여행'}
                        </p>
                        <div className="flex items-center gap-2 text-[11px] text-stone-300 mt-1">
                          <span>{item.site_name || '사이트'}</span>
                          <span>·</span>
                          <span className="text-emerald-300">
                            {item.check_in ? item.check_in.substring(0, 10) : '날짜 미정'}
                          </span>
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-emerald-400 group-hover:translate-x-1 transition-transform" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
