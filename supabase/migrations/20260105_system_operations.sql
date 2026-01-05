-- 시스템 운영 설정 테이블
CREATE TABLE IF NOT EXISTS system_config (
    id INTEGER PRIMARY KEY DEFAULT 1,
    maintenance_mode BOOLEAN DEFAULT false,
    reservation_enabled BOOLEAN DEFAULT true,
    notification_enabled BOOLEAN DEFAULT true,
    maintenance_message TEXT DEFAULT '시스템 점검 중입니다. 잠시 후 다시 이용해 주세요.',
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    updated_by TEXT
);

-- 운영 로그 테이블
CREATE TABLE IF NOT EXISTS operation_logs (
    id SERIAL PRIMARY KEY,
    action TEXT NOT NULL,          -- 'MAINTENANCE_ON', 'MAINTENANCE_OFF', 'RESERVATION_STOP', 'RESERVATION_START', 'CLEAR_CACHE', 'CLEAR_NOTIFICATIONS', 'TODAY_CLOSE'
    previous_state JSONB,
    new_state JSONB,
    actor TEXT DEFAULT 'admin',
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 초기 데이터
INSERT INTO system_config (id, maintenance_mode, reservation_enabled, notification_enabled)
VALUES (1, false, true, true)
ON CONFLICT (id) DO NOTHING;

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_operation_logs_created_at ON operation_logs(created_at DESC);
