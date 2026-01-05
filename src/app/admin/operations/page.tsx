"use client";

import { useState, useEffect, useCallback } from 'react';
import {
    Shield,
    Calendar,
    Bell,
    Trash2,
    RefreshCw,
    ExternalLink,
    CheckCircle,
    AlertTriangle,
    XCircle,
    Loader2,
    Power,
    PowerOff
} from 'lucide-react';
import { toast } from 'sonner';

interface SystemConfig {
    maintenance_mode: boolean;
    reservation_enabled: boolean;
    notification_enabled: boolean;
    maintenance_message: string;
}

interface OperationLog {
    id: number;
    action: string;
    description: string | null;
    created_at: string;
}

interface SystemStats {
    pendingNotifications: number;
    todayReservations: number;
    cacheCount: number;
}

interface SystemStatus {
    config: SystemConfig;
    logs: OperationLog[];
    stats: SystemStats;
}

type OperationAction =
    | 'MAINTENANCE_ON'
    | 'MAINTENANCE_OFF'
    | 'RESERVATION_STOP'
    | 'RESERVATION_START'
    | 'TODAY_CLOSE'
    | 'CLEAR_CACHE'
    | 'CLEAR_NOTIFICATIONS';

// 상태 배지 컴포넌트
function StatusBadge({ status }: { status: 'normal' | 'warning' | 'critical' }) {
    const config = {
        normal: { icon: CheckCircle, color: 'text-green-500', bg: 'bg-green-50', label: '정상' },
        warning: { icon: AlertTriangle, color: 'text-yellow-500', bg: 'bg-yellow-50', label: '주의' },
        critical: { icon: XCircle, color: 'text-red-500', bg: 'bg-red-50', label: '조치 필요' }
    };
    const { icon: Icon, color, bg, label } = config[status];

    return (
        <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium ${bg} ${color}`}>
            <Icon size={16} />
            {label}
        </span>
    );
}

// 즉시 조치 버튼 컴포넌트
function ActionButton({
    icon: Icon,
    label,
    onClick,
    variant = 'default',
    loading = false,
    disabled = false
}: {
    icon: React.ElementType;
    label: string;
    onClick: () => void;
    variant?: 'default' | 'danger' | 'success';
    loading?: boolean;
    disabled?: boolean;
}) {
    const variants = {
        default: 'bg-white hover:bg-gray-50 border-gray-200 text-gray-700',
        danger: 'bg-red-50 hover:bg-red-100 border-red-200 text-red-700',
        success: 'bg-green-50 hover:bg-green-100 border-green-200 text-green-700'
    };

    return (
        <button
            onClick={onClick}
            disabled={loading || disabled}
            className={`flex items-center gap-2 px-4 py-3 rounded-lg border font-medium transition-all ${variants[variant]} disabled:opacity-50 disabled:cursor-not-allowed`}
        >
            {loading ? <Loader2 size={18} className="animate-spin" /> : <Icon size={18} />}
            {label}
        </button>
    );
}

export default function OperationsPage() {
    const [status, setStatus] = useState<SystemStatus | null>(null);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState<OperationAction | null>(null);

    // 시스템 상태 조회
    const fetchStatus = useCallback(async () => {
        try {
            const res = await fetch('/api/admin/operations');
            const data = await res.json();
            setStatus(data);
        } catch (error) {
            console.error('Failed to fetch status:', error);
            toast.error('시스템 상태를 불러오지 못했습니다');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchStatus();
    }, [fetchStatus]);

    // 즉시 조치 실행
    const executeAction = async (action: OperationAction) => {
        setActionLoading(action);
        try {
            const res = await fetch('/api/admin/operations', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action })
            });
            const data = await res.json();

            if (data.success) {
                toast.success(data.description || '조치가 완료되었습니다');
                await fetchStatus(); // 상태 새로고침
            } else {
                toast.error(data.error || '조치 실행에 실패했습니다');
            }
        } catch (error) {
            console.error('Action failed:', error);
            toast.error('조치 실행 중 오류가 발생했습니다');
        } finally {
            setActionLoading(null);
        }
    };

    // 상태 계산
    const getServiceStatus = (): 'normal' | 'warning' | 'critical' => {
        if (!status?.config) return 'normal';
        return status.config.maintenance_mode ? 'critical' : 'normal';
    };

    const getReservationStatus = (): 'normal' | 'warning' | 'critical' => {
        if (!status?.config) return 'normal';
        if (!status.config.reservation_enabled) return 'critical';
        if (status.stats.todayReservations === 0) return 'warning';
        return 'normal';
    };

    const getNotificationStatus = (): 'normal' | 'warning' | 'critical' => {
        if (!status?.stats) return 'normal';
        const pending = status.stats.pendingNotifications;
        if (pending > 500) return 'critical';
        if (pending > 100) return 'warning';
        return 'normal';
    };

    // 액션 레이블 변환
    const getActionLabel = (action: string): string => {
        const labels: Record<string, string> = {
            'MAINTENANCE_ON': '유지보수 모드 활성화',
            'MAINTENANCE_OFF': '유지보수 모드 비활성화',
            'RESERVATION_STOP': '예약 중단',
            'RESERVATION_START': '예약 재개',
            'TODAY_CLOSE': '오늘 예약 마감',
            'CLEAR_CACHE': '캐시 초기화',
            'CLEAR_NOTIFICATIONS': '알림 큐 비우기'
        };
        return labels[action] || action;
    };

    // 시간 포맷
    const formatTime = (dateStr: string): string => {
        const date = new Date(dateStr);
        return date.toLocaleString('ko-KR', {
            month: 'numeric',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* 헤더 */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">시스템 운영</h1>
                    <p className="text-gray-500 mt-1">버튼 클릭 한 번으로 즉시 조치</p>
                </div>
                <button
                    onClick={fetchStatus}
                    className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                >
                    <RefreshCw size={18} />
                    새로고침
                </button>
            </div>

            {/* 운영 상태 대시보드 */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
                <h2 className="text-lg font-semibold mb-4">운영 상태</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                        <div className="flex items-center gap-3">
                            <Shield className="text-gray-400" size={24} />
                            <span className="font-medium">서비스</span>
                        </div>
                        <StatusBadge status={getServiceStatus()} />
                    </div>
                    <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                        <div className="flex items-center gap-3">
                            <Calendar className="text-gray-400" size={24} />
                            <span className="font-medium">예약</span>
                        </div>
                        <StatusBadge status={getReservationStatus()} />
                    </div>
                    <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                        <div className="flex items-center gap-3">
                            <Bell className="text-gray-400" size={24} />
                            <span className="font-medium">알림</span>
                        </div>
                        <StatusBadge status={getNotificationStatus()} />
                    </div>
                </div>

                {/* 현재 상태 요약 */}
                <div className="mt-4 p-4 bg-blue-50 rounded-lg text-sm text-blue-700">
                    <p>📊 캐시: {status?.stats.cacheCount || 0}건 | 대기 알림: {status?.stats.pendingNotifications || 0}건 | 오늘 예약: {status?.stats.todayReservations || 0}건</p>
                </div>
            </div>

            {/* 즉시 조치 버튼 */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* 서비스 보호 */}
                <div className="bg-white rounded-xl border border-gray-200 p-6">
                    <h3 className="font-semibold mb-4 flex items-center gap-2">
                        <Shield size={18} className="text-blue-500" />
                        서비스 보호
                    </h3>
                    <div className="space-y-3">
                        {status?.config.maintenance_mode ? (
                            <ActionButton
                                icon={Power}
                                label="유지보수 OFF"
                                onClick={() => executeAction('MAINTENANCE_OFF')}
                                variant="success"
                                loading={actionLoading === 'MAINTENANCE_OFF'}
                            />
                        ) : (
                            <ActionButton
                                icon={PowerOff}
                                label="유지보수 ON"
                                onClick={() => executeAction('MAINTENANCE_ON')}
                                variant="danger"
                                loading={actionLoading === 'MAINTENANCE_ON'}
                            />
                        )}
                    </div>
                </div>

                {/* 예약 보호 */}
                <div className="bg-white rounded-xl border border-gray-200 p-6">
                    <h3 className="font-semibold mb-4 flex items-center gap-2">
                        <Calendar size={18} className="text-green-500" />
                        예약 보호
                    </h3>
                    <div className="space-y-3">
                        {status?.config.reservation_enabled ? (
                            <ActionButton
                                icon={XCircle}
                                label="예약 중단"
                                onClick={() => executeAction('RESERVATION_STOP')}
                                variant="danger"
                                loading={actionLoading === 'RESERVATION_STOP'}
                            />
                        ) : (
                            <ActionButton
                                icon={CheckCircle}
                                label="예약 재개"
                                onClick={() => executeAction('RESERVATION_START')}
                                variant="success"
                                loading={actionLoading === 'RESERVATION_START'}
                            />
                        )}
                        <ActionButton
                            icon={Calendar}
                            label="오늘 예약 마감"
                            onClick={() => executeAction('TODAY_CLOSE')}
                            loading={actionLoading === 'TODAY_CLOSE'}
                        />
                    </div>
                </div>

                {/* 시스템 복구 */}
                <div className="bg-white rounded-xl border border-gray-200 p-6">
                    <h3 className="font-semibold mb-4 flex items-center gap-2">
                        <RefreshCw size={18} className="text-orange-500" />
                        시스템 복구
                    </h3>
                    <div className="space-y-3">
                        <ActionButton
                            icon={Trash2}
                            label="캐시 초기화"
                            onClick={() => executeAction('CLEAR_CACHE')}
                            loading={actionLoading === 'CLEAR_CACHE'}
                        />
                        <ActionButton
                            icon={Bell}
                            label="알림 큐 비우기"
                            onClick={() => executeAction('CLEAR_NOTIFICATIONS')}
                            loading={actionLoading === 'CLEAR_NOTIFICATIONS'}
                        />
                        <a
                            href="https://supabase.com/dashboard"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 px-4 py-3 rounded-lg border border-gray-200 bg-gray-50 hover:bg-gray-100 text-gray-700 font-medium transition-all"
                        >
                            <ExternalLink size={18} />
                            전체 DB 복구 (Supabase)
                        </a>
                    </div>
                </div>
            </div>

            {/* 최근 조치 이력 */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
                <h3 className="font-semibold mb-4">최근 조치 이력</h3>
                {status?.logs && status.logs.length > 0 ? (
                    <div className="space-y-2">
                        {status.logs.map((log) => (
                            <div key={log.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                <div className="flex items-center gap-3">
                                    <span className="text-gray-400 text-sm">{formatTime(log.created_at)}</span>
                                    <span className="font-medium">{log.description || getActionLabel(log.action)}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <p className="text-gray-400 text-center py-8">조치 이력이 없습니다</p>
                )}
            </div>
        </div>
    );
}
