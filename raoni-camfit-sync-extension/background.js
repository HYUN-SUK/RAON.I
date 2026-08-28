// ==============================================================================
// [라온아이 ➔ 캠핏 실시간 예약 동기화 마스터] 백그라운드 서비스 워커
// ==============================================================================

const DEFAULT_SERVER_URL = 'https://raon-i.co.kr'; // 기본 프로덕션 서버 (로컬 테스트 시 popup에서 http://localhost:3000 변경 가능)
const ALARM_NAME = 'RAONI_CAMFIT_SYNC_POLL';
const POLL_INTERVAL_MINUTES = 0.25; // 약 15초 주기

// 1. 확장프로그램 설치 및 시작 시 즉시 검사 & 알람 등록
chrome.runtime.onInstalled.addListener(() => {
    console.log('[Raoni Sync] Service Worker Installed - Checking queue immediately...');
    setupAlarm();
    checkAndSyncQueue(); // [FIX] 설치/새로고침 즉시 0초 검사 실행
    logHistory('시스템', '라온아이 동기화 마스터가 정상 시작되었습니다.');
});

chrome.runtime.onStartup.addListener(() => {
    console.log('[Raoni Sync] Service Worker Startup - Checking queue immediately...');
    setupAlarm();
    checkAndSyncQueue(); // [FIX] 브라우저 시작 즉시 검사
});

// 캠핏 관리자 탭이 열리거나 새로고침(F5)될 때 즉시 동기화 트리거
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete' && tab.url && tab.url.includes('camfit.co.kr')) {
        console.log('[Raoni Sync] CamFit Tab updated - triggering instant sync...');
        checkAndSyncQueue();
    }
});

// 고속 10초 주기 인터벌 백업 (Service Worker 활성 상태 시 10초 주기 보장)
setInterval(() => {
    checkAndSyncQueue();
}, 10000);

function setupAlarm() {
    chrome.alarms.create(ALARM_NAME, {
        periodInMinutes: POLL_INTERVAL_MINUTES
    });
}

// 2. 주기적 알람 트리거 ➔ 동기화 큐 검사
chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === ALARM_NAME) {
        checkAndSyncQueue();
    }
});

// 3. 팝업 등에서 수동 동기화 요청 시 수신
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'MANUAL_SYNC') {
        checkAndSyncQueue().then(res => sendResponse(res));
        return true;
    }
});

// 4. 메인 동기화 큐 처리 함수
async function checkAndSyncQueue() {
    let serverUrl = DEFAULT_SERVER_URL;
    try {
        const config = await getStorageData(['serverUrl']);
        serverUrl = config.serverUrl || DEFAULT_SERVER_URL;

        // 1) 라온아이 백엔드 큐 조회 (타임아웃 5초 설정)
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);

        let res;
        try {
            res = await fetch(`${serverUrl}/api/admin/camfit-sync/queue`, {
                signal: controller.signal,
                headers: { 'Accept': 'application/json' }
            });
        } catch (fetchErr) {
            clearTimeout(timeoutId);
            console.warn(`[Raoni Sync] Server unreachable (${serverUrl}):`, fetchErr.message);
            await logHistory('연결 대기', `서버 응답 대기 중 (${serverUrl}) - 서버 상태 확인 필요`, 'INFO');
            return { success: false, message: `서버 연결 실패 (${serverUrl})` };
        }
        clearTimeout(timeoutId);

        if (!res.ok) {
            console.warn('[Raoni Sync] Failed to fetch queue:', res.status);
            await logHistory('서버 응답 오류', `HTTP 상태 코드: ${res.status}`, 'WARNING');
            return { success: false, message: `서버 응답 오류 (${res.status})` };
        }

        const data = await res.json();
        if (!data.success || !data.queue || data.queue.length === 0) {
            // 대기 건 없음 (정상 상태)
            return { success: true, count: 0, message: '동기화 대기 중인 예약이 없습니다.' };
        }

        console.log(`[Raoni Sync] Found ${data.queue.length} pending items to sync to CamFit`);

        // 2) 켜져 있는 캠핏 관리자 탭 탐색
        const tabs = await chrome.tabs.query({ url: '*://*.camfit.co.kr/*' });
        if (!tabs || tabs.length === 0) {
            console.warn('[Raoni Sync] No active CamFit tabs found.');
            await logHistory('캠핏 탭 대기', '캠핏 관리자 창이 열려있지 않아 차단을 대기합니다.', 'WARNING');
            return { success: false, count: data.queue.length, message: '캠핏 관리자 창이 열려있지 않습니다.' };
        }

        const targetTab = tabs[0];

        // 3) 대기 중인 예약 건들을 순차적으로 캠핏 탭에 주입하여 자동 차단/생성/취소 실행
        let successCount = 0;
        for (const item of data.queue) {
            try {
                // 캠핏 탭의 content.js로 작업 실행 명령 전송
                const syncResult = await chrome.tabs.sendMessage(targetTab.id, {
                    action: 'EXECUTE_CAMFIT_SYNC',
                    data: item
                });

                const actionLabel = item.action === 'CREATE_RESERVATION' ? '예약생성(초록)' : (item.action === 'UNBLOCK_CANCEL' ? '차단해제(빈자리복구)' : '입금대기차단(빨강)');

                if (syncResult && syncResult.success) {
                    // 4) 라온아이 백엔드에 ACK 전송
                    await sendAck(serverUrl, item, 'SUCCESS');
                    successCount++;

                    // 5) 브라우저 데스크톱 알림 발송
                    showNotification(
                        `⛺ [라온아이 ➔ 캠핏 ${actionLabel} 완료]`,
                        `[${item.subSiteName || item.targetGroup}] ${item.checkInDate} ~ ${item.checkOutDate}\n고객: ${item.guestName}`
                    );

                    await logHistory(
                        '동기화완료',
                        `[${item.subSiteName || item.targetGroup}] ${item.guestName}님 일정(${item.checkInDate}~${item.checkOutDate}) 캠핏 ${actionLabel} 성공`,
                        'SUCCESS'
                    );
                } else {
                    const errMsg = syncResult?.error || '캠핏 페이지 내부 처리 실패';
                    await sendAck(serverUrl, item, 'FAILED', errMsg);
                    await logHistory('실패', `[${item.subSiteName || item.targetGroup}] ${actionLabel} 실패: ${errMsg}`, 'ERROR');
                }
            } catch (tabErr) {
                console.error('[Raoni Sync] Error communicating with CamFit tab:', tabErr);
                await logHistory('통신오류', `캠핏 탭 통신 오류: ${tabErr.message}`, 'ERROR');
            }
        }

        return { success: true, count: successCount };
    } catch (err) {
        console.error('[Raoni Sync] checkAndSyncQueue Error:', err);
        return { success: false, error: err.message };
    }
}

// 5. ACK 전송 헬퍼
async function sendAck(serverUrl, item, status, errorMessage = '') {
    try {
        await fetch(`${serverUrl}/api/admin/camfit-sync/ack`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                reservationId: item.reservationId,
                action: item.action,
                siteName: item.subSiteName || item.targetGroup,
                checkInDate: item.checkInDate,
                checkOutDate: item.checkOutDate,
                guestName: item.guestName,
                status,
                errorMessage
            })
        });
    } catch (e) {
        console.error('[Raoni Sync] sendAck failed:', e);
    }
}

// 6. 브라우저 데스크톱 알림 (안전 가드)
function showNotification(title, message) {
    try {
        if (chrome.notifications && chrome.notifications.create) {
            chrome.notifications.create({
                type: 'basic',
                iconUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
                title: title,
                message: message,
                priority: 2
            }, () => {
                if (chrome.runtime.lastError) {
                    console.log('[Raoni Sync] Notification notice (ignored):', chrome.runtime.lastError.message);
                }
            });
        }
    } catch (notifErr) {
        console.warn('[Raoni Sync] showNotification safely bypassed:', notifErr);
    }
}

// 7. 로컬 히스토리 로깅 (최대 30건 보관)
async function logHistory(title, detail, type = 'INFO') {
    const timeStr = new Date().toLocaleTimeString('ko-KR', { hour12: false });
    const newEntry = {
        id: Date.now(),
        time: timeStr,
        title,
        detail,
        type
    };

    const data = await getStorageData(['syncHistory']);
    const history = data.syncHistory || [];
    const updated = [newEntry, ...history].slice(0, 30);
    await setStorageData({ syncHistory: updated, lastSyncTime: timeStr });
}

// Storage Helpers
function getStorageData(keys) {
    return new Promise((resolve) => {
        chrome.storage.local.get(keys, (res) => resolve(res || {}));
    });
}

function setStorageData(obj) {
    return new Promise((resolve) => {
        chrome.storage.local.set(obj, () => resolve());
    });
}
