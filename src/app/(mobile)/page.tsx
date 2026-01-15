'use client';

import React, { useState, useEffect } from 'react';
import BeginnerHome from '@/components/home/BeginnerHome';
import ReturningHome from '@/components/home/ReturningHome';

import { createClient } from '@/lib/supabase-client';

/**
 * Home State Engine
 * 
 * 사용자 상태(신규/기존)에 따라 홈 화면을 분기합니다.
 * 기준: 예약 이용 완료 이력 (체크아웃 날짜가 지난 취소 안 된 예약 1건+)
 */
export default function Home() {
  const [isFirstTimeUser, setIsFirstTimeUser] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [isMounted, setIsMounted] = useState(false);

  // [DEV ONLY] State to force toggle view
  const [devForceView, setDevForceView] = useState<'auto' | 'beginner' | 'returning'>('auto');

  useEffect(() => {
    setIsMounted(true);
    checkUserType();
  }, []);

  /**
   * 사용자 유형 판별
   * - 비로그인 → 초보자
   * - 로그인 + 이용완료 예약 0건 → 초보자
   * - 로그인 + 이용완료 예약 1건+ → 기존 사용자
   */
  const checkUserType = async () => {
    try {
      const supabase = createClient();

      // 1. 로그인 상태 확인
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setIsFirstTimeUser(true);
        setIsLoading(false);
        return;
      }

      // 2. 이용 완료된 예약 조회 (체크아웃 날짜가 오늘 이전 + 취소되지 않음)
      const today = new Date().toISOString().split('T')[0];
      const { count, error } = await supabase
        .from('reservations')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', session.user.id)
        .neq('status', 'CANCELLED')
        .lt('check_out_date', today);

      if (error) {
        console.error('Error checking user reservation history:', error);
        setIsFirstTimeUser(true);
      } else {
        // 이용 완료 예약이 1건 이상이면 기존 사용자
        setIsFirstTimeUser((count ?? 0) === 0);
      }
    } catch (err) {
      console.error('Error in checkUserType:', err);
      setIsFirstTimeUser(true);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isMounted || isLoading) return null; // Hydration 이슈 방지 + 로딩 대기

  // Determine actual view based on dev force state or logic
  const showBeginner = devForceView === 'auto' ? isFirstTimeUser : devForceView === 'beginner';

  const isDev = process.env.NODE_ENV === 'development';

  return (
    <main className="relative w-full min-h-screen bg-[#F7F5EF] dark:bg-black">
      {/* 
        [DEV ONLY] 상태 전환 토글 버튼 
        개발 환경에서만 우측 하단에 플로팅 버튼으로 표시
      */}
      {isDev && (
        <div className="fixed bottom-24 right-4 z-[9999] flex flex-col gap-2">
          <button
            onClick={() => setDevForceView(prev => prev === 'beginner' ? 'returning' : 'beginner')}
            className="bg-red-500/80 hover:bg-red-600 text-white text-[10px] font-bold px-3 py-1.5 rounded-full shadow-lg backdrop-blur-sm transition-all active:scale-95"
          >
            {showBeginner ? '🔄 To User' : '🔄 To Begin'}
          </button>
        </div>
      )}

      {/* 상태에 따른 화면 렌더링 */}
      {showBeginner ? (
        <BeginnerHome />
      ) : (
        <ReturningHome />
      )}
    </main>
  );
}
