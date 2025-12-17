'use client';

import React, { useState, useEffect } from 'react';
import BeginnerHome from '@/components/home/BeginnerHome';
import ReturningHome from '@/components/home/ReturningHome';
import { Button } from '@/components/ui/button';

/**
 * Home State Engine
 * 
 * 사용자 상태(신규/기존)에 따라 홈 화면을 분기합니다.
 * 현재는 백엔드 연동 전이므로 로컬 상태로 Mocking 합니다.
 */
export default function Home() {
  // 초기 상태: true (초보자 모드), false (기존 사용자 모드)
  // 실제 구현 시에는 User Store 또는 API에서 상태를 가져와야 합니다.
  const [isFirstTimeUser, setIsFirstTimeUser] = useState(true);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsMounted(true);
  }, []);

  if (!isMounted) return null; // Hydration 이슈 방지

  return (
    <main className="relative w-full min-h-screen bg-[#F7F5EF] dark:bg-black">
      {/* 
        [DEV ONLY] 상태 전환 토글 버튼 
        개발 및 데모 시연을 위해 우측 상단에 임시로 배치합니다.
      */}
      <div className="fixed top-20 right-4 z-50 opacity-50 hover:opacity-100 transition-opacity">
        <Button
          variant="outline"
          size="sm"
          className="bg-white/80 backdrop-blur text-xs h-7"
          onClick={() => setIsFirstTimeUser(!isFirstTimeUser)}
        >
          {isFirstTimeUser ? '모드: 초보자' : '모드: 기존 유저'}
        </Button>
      </div>

      {/* 상태에 따른 화면 렌더링 */}
      {isFirstTimeUser ? (
        <BeginnerHome />
      ) : (
        <ReturningHome />
      )}
    </main>
  );
}
