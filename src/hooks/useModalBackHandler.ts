'use client';

import { useEffect } from 'react';

/**
 * 모달/시트가 열렸을 때 스마트폰 뒤로가기(popstate) 실행 시
 * 페이지가 이동하지 않고 모달만 내려가도록 제어하는 훅
 */
export function useModalBackHandler(
    isOpen: boolean,
    onClose: () => void,
    modalKey: string = 'modal'
) {
    useEffect(() => {
        // [v11.9.150] Next.js 라우터 충돌 및 Full Refresh 튕김 버그 원천 방지를 위해 히스토리 조작 로직 비활성화
        // 모달 닫기 시 back()과 router.push()가 겹칠 때 발생하는 Race Condition 차단 목적
    }, [isOpen, onClose, modalKey]);
}
