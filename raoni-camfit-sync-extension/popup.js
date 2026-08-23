document.addEventListener('DOMContentLoaded', async () => {
    const btnSync = document.getElementById('btnSync');
    const logsBox = document.getElementById('logsBox');
    const logCount = document.getElementById('logCount');
    const lastSyncText = document.getElementById('lastSyncText');
    const toggleSettings = document.getElementById('toggleSettings');
    const settingsBox = document.getElementById('settingsBox');
    const serverUrlInput = document.getElementById('serverUrlInput');
    const btnSaveUrl = document.getElementById('btnSaveUrl');

    // 1. 저장된 데이터 로드
    chrome.storage.local.get(['serverUrl', 'syncHistory', 'lastSyncTime'], (res) => {
        if (res.serverUrl) {
            serverUrlInput.value = res.serverUrl;
        }
        if (res.lastSyncTime) {
            lastSyncText.innerText = `최근 검사: ${res.lastSyncTime}`;
        }
        renderLogs(res.syncHistory || []);
    });

    // 2. 수동 동기화 버튼 클릭
    btnSync.addEventListener('click', () => {
        btnSync.disabled = true;
        btnSync.innerText = '동기화 검사 중...';

        chrome.runtime.sendMessage({ action: 'MANUAL_SYNC' }, (response) => {
            btnSync.disabled = false;
            btnSync.innerText = '⚡ 지금 즉시 동기화 검사';

            // 로그 다시 로드
            chrome.storage.local.get(['syncHistory', 'lastSyncTime'], (res) => {
                if (res.lastSyncTime) {
                    lastSyncText.innerText = `최근 검사: ${res.lastSyncTime}`;
                }
                renderLogs(res.syncHistory || []);
            });
        });
    });

    // 3. 로그 렌더링 헬퍼
    function renderLogs(logs) {
        logCount.innerText = `${logs.length}건`;
        if (logs.length === 0) {
            logsBox.innerHTML = '<div class="empty-logs">아직 동기화 이력이 없습니다.</div>';
            return;
        }

        logsBox.innerHTML = logs.map(log => {
            const colorClass = log.type === 'SUCCESS' ? '#16a34a' : log.type === 'ERROR' ? '#dc2626' : '#2563eb';
            return `
                <div class="log-item">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <span style="font-weight: 700; color: ${colorClass};">${log.title}</span>
                        <span class="log-time">${log.time}</span>
                    </div>
                    <div class="log-detail">${log.detail}</div>
                </div>
            `;
        }).join('');
    }

    // 4. 설정 토글
    toggleSettings.addEventListener('click', () => {
        const isHidden = settingsBox.style.display === 'none' || !settingsBox.style.display;
        settingsBox.style.display = isHidden ? 'block' : 'none';
    });

    // 5. 서버 URL 저장
    btnSaveUrl.addEventListener('click', () => {
        const newUrl = serverUrlInput.value.trim();
        if (newUrl) {
            chrome.storage.local.set({ serverUrl: newUrl }, () => {
                btnSaveUrl.innerText = '저장 완료 ✓';
                setTimeout(() => { btnSaveUrl.innerText = '저장'; }, 1500);
            });
        }
    });
});
