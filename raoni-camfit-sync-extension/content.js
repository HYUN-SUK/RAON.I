// ==============================================================================
// [라온아이 ➔ 캠핏 실시간 예약 동기화 마스터 v2.0] 캠핏 관리자 웹페이지 주입 스크립트
// ==============================================================================

console.log('[Raoni Content Script v2.0] Injected into CamFit Admin:', window.location.href);

// 백그라운드로부터 동기화 실행 명령 수신
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'EXECUTE_CAMFIT_SYNC' || request.action === 'EXECUTE_CAMFIT_BLOCK') {
        console.log('[Raoni Content Script] Received Order:', request.data);
        handleCamfitSync(request.data)
            .then(result => sendResponse(result))
            .catch(err => sendResponse({ success: false, error: err.message }));
        return true; // 비동기 응답 대기
    }
});

/**
 * 딜레이 유틸리티
 */
const delay = (ms) => new Promise(r => setTimeout(r, ms));

/**
 * React / Vue 입력창 값 강제 주입 헬퍼 (Synthetic Event 트리거)
 */
function setNativeInputValue(inputElement, value) {
    if (!inputElement) return;
    const lastValue = inputElement.value;
    inputElement.value = value;
    
    // React / Vue 내부 상태 갱신을 위한 input 및 change 이벤트 디스패치
    const event = new Event('input', { bubbles: true });
    const tracker = inputElement._valueTracker;
    if (tracker) {
        tracker.setValue(lastValue);
    }
    inputElement.dispatchEvent(event);
    inputElement.dispatchEvent(new Event('change', { bubbles: true }));
}

/**
 * 특정 조건의 요소를 대기하며 찾는 헬퍼
 */
async function waitForElement(selectorFn, maxWaitMs = 5000, intervalMs = 200) {
    const startTime = Date.now();
    while (Date.now() - startTime < maxWaitMs) {
        const el = selectorFn();
        if (el) return el;
        await delay(intervalMs);
    }
    return null;
}

/**
 * 텍스트 기반 물리 좌표(Y축) 정렬 버튼 탐색 헬퍼 (태그 무관)
 */
function findButtonsByText(targetText) {
    const allElements = Array.from(document.querySelectorAll('button, div, span, a, p, input[type="button"], input[type="submit"]'));
    const matches = allElements.filter(el => {
        const t = (el.innerText || el.textContent || el.value || '').trim();
        const rect = el.getBoundingClientRect();
        const isVisible = el.offsetParent !== null && rect.height > 0 && rect.width > 0;
        // 텍스트가 정확히 일치하거나 포함하면서 자식 텍스트가 너무 길지 않은 인터랙티브 요소
        return isVisible && (t === targetText || (t.startsWith(targetText) && t.length < targetText.length + 5));
    });

    // Y 좌표(화면 상단으로부터의 거리) 기준 오름차순 정렬 (가장 위쪽 요소가 0번 인덱스)
    return matches.sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top);
}

/**
 * 캠핏 관리자 페이지 내에서 사이트 자동 차단/생성/취소를 실행하는 핵심 엔진
 */
async function handleCamfitSync(item) {
    const {
        action,           // 'BLOCK_PENDING' | 'CREATE_RESERVATION' | 'UNBLOCK_CANCEL'
        targetGroup,      // '민수네', '철수네', '에어컨 대여' 등
        subSiteName,      // '민수네', '에어컨 1' 등
        isAircon,         // true / false
        checkInDate,      // '2026-10-02'
        checkOutDate,     // '2026-10-04'
        nights,           // 1, 2, ...
        guestName,
        guestPhone,
        memo
    } = item;

    const actionLabel = action === 'CREATE_RESERVATION' ? '예약생성(초록)' : (action === 'UNBLOCK_CANCEL' ? '차단해제(빈자리복구)' : '입금대기차단(빨강)');

    try {
        console.log(`[Raoni Sync] Executing [${actionLabel}] for ${subSiteName || targetGroup} (${checkInDate} ~ ${checkOutDate})`);
        showInPageToast(`[라온아이] ${subSiteName || targetGroup} ${actionLabel} 처리 중...`);

        // 1. 캘린더 화면 URL 보장 (#/apps/calendar)
        if (!window.location.hash.includes('calendar')) {
            console.log('[Raoni Sync] Navigating to calendar view...');
            window.location.hash = '#/apps/calendar';
            await delay(1000);
        }

        // 2. 캘린더 날짜 탐색 (일자 추출, 예: '2026-10-02' -> 2)
        const inDateObj = new Date(checkInDate);
        const dayNum = inDateObj.getDate(); // 2
        const dayNumStr = `${dayNum}일`;   // '2일' or '2'

        // 3. 2차원 교차 탐색: 날짜 열 안에서 targetGroup 셀 찾기
        const cellEl = await waitForElement(() => {
            const allElements = Array.from(document.querySelectorAll('*'));
            
            // 캘린더 내 사이트 태그들 (예: "[민수네] 0/1", "[에어컨 대여] 0/8")
            return allElements.find(el => {
                const text = (el.innerText || el.textContent || '').trim();
                const matchesGroup = text.includes(`[${targetGroup}]`) || text.startsWith(`[${targetGroup}]`);
                if (!matchesGroup) return false;

                // 부모나 조상 엘리먼트 중에 해당 날짜가 포함되어 있는지 확인
                let parent = el.parentElement;
                let foundDay = false;
                for (let i = 0; i < 6 && parent; i++) {
                    const pText = parent.innerText || '';
                    if (pText.includes(dayNumStr) || pText.includes(`${dayNum}`)) {
                        foundDay = true;
                        break;
                    }
                    parent = parent.parentElement;
                }
                return foundDay;
            }) || allElements.find(el => {
                const text = (el.innerText || el.textContent || '').trim();
                return text.includes(`[${targetGroup}]`);
            });
        }, 4000);

        if (!cellEl) {
            throw new Error(`캘린더에서 [${checkInDate}] [${targetGroup}] 셀을 찾을 수 없습니다.`);
        }

        // 4. 셀 클릭 ➔ 오른쪽 관리 패널 오픈
        cellEl.click();
        await delay(500);

        // 6. 우측 패널 컨테이너 탐색 및 상단/하단 영역 분리
        await delay(500);

        // [구조 1] 상단 '캠핑존 예약 불가 설정' 영역
        const topBlockSection = Array.from(document.querySelectorAll('div, section, form, .card')).find(el => {
            const t = (el.innerText || '').trim();
            return t.includes('캠핑존 예약 불가 설정') && (t.includes('적용') || t.includes('해제'));
        }) || document.querySelector('.top-section') || document;

        // [구조 2] 하단 '캠핑 사이트 목록' 테이블 영역
        const bottomSiteSection = Array.from(document.querySelectorAll('div, section, table, .card')).find(el => {
            const t = (el.innerText || '').trim();
            return t.includes('캠핑 사이트 목록') || t.includes('사이트명') || t.includes('예약 생성');
        }) || document;

        // 하단 테이블에서 개별 사이트(예: 에어컨 1번 등) 타겟 행 탐색
        let targetSiteRow = null;
        if (isAircon && subSiteName) {
            targetSiteRow = Array.from(bottomSiteSection.querySelectorAll('tr, div, .row')).find(r => {
                const t = (r.innerText || '').trim();
                return t.includes(subSiteName);
            });
        }

        // ==========================================================
        // [Action 1] 입금 대기 차단 (BLOCK_PENDING - 상단 빨간색 예약불가)
        // ==========================================================
        if (action === 'BLOCK_PENDING') {
            console.log('[Raoni Sync] Targeting Top Block Section for BLOCK_PENDING...');

            // 1) 상단 박수 드롭다운 선택
            const selectEl = topBlockSection.querySelector('select') || document.querySelector('select');
            if (selectEl) {
                const targetNightText = `${nights}박`;
                const option = Array.from(selectEl.options).find(opt => opt.text.includes(targetNightText) || opt.value.includes(`${nights}`));
                if (option) {
                    selectEl.value = option.value;
                    selectEl.dispatchEvent(new Event('change', { bubbles: true }));
                }
            }

            // 2) 상단 메모 입력창 값 주입
            const memoInput = topBlockSection.querySelector('input[type="text"], input[placeholder*="메모"]') || document.querySelector('input[placeholder*="메모"]');
            if (memoInput) {
                setNativeInputValue(memoInput, memo || `[RAON.I_APP] 입금대기 - ${guestName} (${guestPhone})`);
            }

            await delay(300);

            // 3) 상단 [적용] 버튼 클릭 (물리 좌표 Y축 최소값 = 화면 최상단 적용 버튼)
            const applyButtons = findButtonsByText('적용');
            const topApplyBtn = applyButtons[0]; // 화면에서 가장 위쪽에 위치한 상단 적용 버튼

            if (topApplyBtn) {
                console.log('[Raoni Sync] Clicking Top Apply Button (Geometry Top):', topApplyBtn);
                topApplyBtn.click();
                await delay(800);
            } else {
                throw new Error('화면에서 [적용] 버튼을 찾을 수 없습니다.');
            }

            showInPageToast(`✓ [라온아이] ${subSiteName || targetGroup} 입금대기 자동 차단 완료! (빨강)`, true);
        }

        // ==========================================================
        // [Action 2] 입금 완료 확정 (CREATE_RESERVATION - 초록색 예약 생성)
        // ==========================================================
        else if (action === 'CREATE_RESERVATION') {
            console.log('[Raoni Sync] Executing CREATE_RESERVATION (Unblock Top + Create Bottom)...');

            // 1) 상단에 걸려있던 예약불가 [해제] 버튼이 있다면 먼저 해제 (Y축 최상단 해제 버튼)
            const unblockButtons = findButtonsByText('해제');
            const topUnblockBtn = unblockButtons[0];

            if (topUnblockBtn) {
                console.log('[Raoni Sync] Clearing Top Block first (Geometry Top):', topUnblockBtn);
                topUnblockBtn.click();
                await delay(600);
                const confirmBtn = document.querySelector('.modal-confirm, button.confirm, button.primary');
                if (confirmBtn) { confirmBtn.click(); await delay(500); }
            }

            // 2) 하단 테이블에서 [예약 생성] 버튼 탐색 및 클릭
            const targetScope = targetSiteRow || bottomSiteSection || document;
            const createResBtn = Array.from(targetScope.querySelectorAll('button, a, span, div')).find(btn => {
                const t = (btn.innerText || '').trim();
                return t === '예약 생성' || t.includes('예약 생성') || t.includes('직접 예약');
            }) || Array.from(document.querySelectorAll('button, a, span, div')).find(btn => {
                const t = (btn.innerText || '').trim();
                return t === '예약 생성' || t.includes('예약 생성');
            });

            if (createResBtn) {
                console.log('[Raoni Sync] Opening Create Reservation Modal...');
                createResBtn.click();
                await delay(800);

                const modal = document.querySelector('.modal, .dialog, .drawer, [role="dialog"]') || document;
                const nameInput = modal.querySelector('input[placeholder*="이름"], input[placeholder*="고객"], input[name*="name"]');
                const phoneInput = modal.querySelector('input[placeholder*="연락처"], input[placeholder*="전화"], input[name*="phone"]');
                const memoInput = modal.querySelector('textarea, input[placeholder*="메모"]');

                if (nameInput) setNativeInputValue(nameInput, `${guestName} [RAON.I_APP]`);
                if (phoneInput) setNativeInputValue(phoneInput, guestPhone || '');
                if (memoInput) setNativeInputValue(memoInput, memo || `[RAON.I_APP_BLOCK] 입금완료 (${guestPhone})`);

                await delay(300);

                const saveBtn = Array.from(modal.querySelectorAll('button, a, div')).find(b => {
                    const t = (b.innerText || '').trim();
                    return t === '저장' || t === '예약' || t.includes('완료') || t.includes('등록') || t.includes('확인');
                });

                if (saveBtn) {
                    saveBtn.click();
                    await delay(800);
                } else {
                    throw new Error('예약 생성 모달 내 [저장/등록] 버튼을 찾을 수 없습니다.');
                }
            } else {
                // 하단에 예약 생성 버튼이 없는 경우 하단 메모 적용 Fallback
                const memoInput = targetScope.querySelector('input[type="text"], input[placeholder*="메모"]');
                if (memoInput) {
                    setNativeInputValue(memoInput, memo || `[RAON.I_APP_BLOCK] 입금완료 - ${guestName}`);
                    const applyBtn = Array.from(targetScope.querySelectorAll('button, div')).find(btn => (btn.innerText || '').includes('적용'));
                    if (applyBtn) { applyBtn.click(); await delay(800); }
                }
            }

            showInPageToast(`✓ [라온아이] ${subSiteName || targetGroup} 입금완료 자동 확정 완료! (초록)`, true);
        }

        // ==========================================================
        // [Action 3] 예약 취소 (UNBLOCK_CANCEL - 빈자리 복원)
        // ==========================================================
        else if (action === 'UNBLOCK_CANCEL') {
            console.log('[Raoni Sync] Executing UNBLOCK_CANCEL...');

            const unblockBtn = Array.from(document.querySelectorAll('button')).find(btn => {
                const t = (btn.innerText || '').trim();
                return t === '해제' || t.includes('해제') || t.includes('삭제') || t.includes('취소');
            });

            if (unblockBtn) {
                unblockBtn.click();
                await delay(600);

                const confirmBtn = Array.from(document.querySelectorAll('button')).find(b => {
                    const t = (b.innerText || '').trim();
                    return t === '확인' || t === '승인' || t.includes('확인');
                });
                if (confirmBtn) {
                    confirmBtn.click();
                    await delay(600);
                }
            } else {
                console.log(`[Raoni Sync] No active block to unblock for ${subSiteName || targetGroup}.`);
            }

            showInPageToast(`✓ [라온아이] ${subSiteName || targetGroup} 차단 해제 및 빈자리 복원 완료!`, true);
        }

        return {
            success: true,
            action,
            targetGroup,
            subSiteName,
            checkInDate,
            checkOutDate,
            syncedAt: new Date().toISOString()
        };
    } catch (err) {
        console.error('[Raoni Content Script] Sync Execution Failed:', err);
        showInPageToast(`❌ [라온아이] ${subSiteName || targetGroup} ${actionLabel} 실패: ${err.message}`, false);
        return {
            success: false,
            error: err.message
        };
    }
}

/**
 * 캠핏 화면 우측 상단에 라온아이 전용 플로팅 토스트를 띄워주는 헬퍼
 */
function showInPageToast(message, isSuccess = true) {
    let container = document.getElementById('raoni-toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'raoni-toast-container';
        container.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 999999;
            display: flex;
            flex-direction: column;
            gap: 10px;
            pointer-events: none;
            font-family: -apple-system, BlinkMacSystemFont, "Pretendard", sans-serif;
        `;
        document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.style.cssText = `
        background: ${isSuccess ? '#224732' : '#991b1b'};
        color: #ffffff;
        padding: 12px 18px;
        border-radius: 12px;
        font-size: 13px;
        font-weight: 700;
        box-shadow: 0 8px 24px rgba(0,0,0,0.25);
        display: flex;
        align-items: center;
        gap: 8px;
        transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        transform: translateY(-10px);
        opacity: 0;
    `;
    toast.innerText = message;
    container.appendChild(toast);

    requestAnimationFrame(() => {
        toast.style.transform = 'translateY(0)';
        toast.style.opacity = '1';
    });

    setTimeout(() => {
        toast.style.transform = 'translateY(-10px)';
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}
