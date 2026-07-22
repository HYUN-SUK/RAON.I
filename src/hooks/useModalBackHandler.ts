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
        if (!isOpen) return;

        // 히스토리에 모달 상태 추가
        window.history.pushState({ modalKey }, '');

        const handlePopState = (event: PopStateEvent) => {
            // 뒤로가기 트리거 시 모달만 닫기
            onClose();
        };

        window.addEventListener('popstate', handlePopState);

        return () => {
            window.removeEventListener('popstate', handlePopState);
        };
    }, [isOpen, onClose, modalKey]);
}
