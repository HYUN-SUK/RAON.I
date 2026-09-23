"use client";

import { useEffect } from "react";

/**
 * SystemThemeColorSync
 * 
 * 안드로이드 Chrome 및 WebAPK(홈 화면에 추가된 PWA)에서 
 * 기기 상단 상태표시줄과 하단 3버튼 내비게이션 바의 색상을 
 * 앱 재설치 없이 실시간으로 강제 동기화(#FFFFFF / #18181B)하는 컴포넌트입니다.
 */
export default function SystemThemeColorSync() {
  useEffect(() => {
    const applyThemeColor = () => {
      try {
        const isDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
        const targetColor = isDark ? "#18181B" : "#FFFFFF";

        // 기존 모든 theme-color 메타 태그 검색
        const metas = document.querySelectorAll('meta[name="theme-color"]');
        if (metas.length > 0) {
          metas.forEach((meta) => {
            meta.setAttribute("content", targetColor);
          });
        } else {
          const meta = document.createElement("meta");
          meta.name = "theme-color";
          meta.content = targetColor;
          document.head.appendChild(meta);
        }
      } catch (err) {
        console.warn("[SystemThemeColorSync] Failed to sync theme color:", err);
      }
    };

    // 1. 컴포넌트 마운트 시 즉시 실행
    applyThemeColor();

    // 2. OS 라이트/다크 모드 변경 실시간 감지
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => applyThemeColor();

    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener("change", handler);
      return () => mediaQuery.removeEventListener("change", handler);
    } else if (mediaQuery.addListener) {
      mediaQuery.addListener(handler);
      return () => mediaQuery.removeListener(handler);
    }
  }, []);

  return null;
}
