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

        // 히스토리에 모달 식별 상태 추가 (PWA 뒤로가기 제어 및 찌꺼기 추적용)
        const stateKey = `raon_modal_${modalKey}_${Date.now()}`;
        window.history.pushState({ modalKey, stateKey, isRaonModal: true }, '');

        const handlePopState = (event: PopStateEvent) => {
            // 사용자가 브라우저 백버튼 등으로 뒤로가기 시 모달 닫기
            onClose();
        };

        window.addEventListener('popstate', handlePopState);

        return () => {
            window.removeEventListener('popstate', handlePopState);
            
            // 프로그램적으로 모달이 닫혀서(X 버튼 등) 가상 히스토리 찌꺼기가 스택 최상단에 남은 경우 강제 정화
            try {
                if (typeof window !== 'undefined' && window.history.state?.isRaonModal && window.history.state?.stateKey === stateKey) {
                    window.history.back();
                }
            } catch (e) {
                console.warn('[useModalBackHandler] Failed to cleanup modal history state:', e);
            }
        };
    }, [isOpen, onClose, modalKey]);
}
