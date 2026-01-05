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
    PowerOff,
    HelpCircle
} from 'lucide-react';
import { toast } from 'sonner';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogTrigger,
} from "@/components/ui/dialog";

// 도움말 데이터 정의
const HELP_GUIDES = {
    SERVICE_PROTECTION: {
        title: "서비스 보호 가이드",
        items: [
            {
                action: "유지보수 ON/OFF",
                when: "사이트 업데이트, 긴급 버그 수정, 전체 점검이 필요할 때 사용하세요.",
                what: "사용자가 사이트에 접속하면 '점검 중' 메시지가 뜨고 모든 기능을 사용할 수 없게 됩니다. (관리자는 접속 가능)",
                caution: "점검이 끝나면 반드시 OFF로 변경해 주세요."
            }
        ]
    },
    RESERVATION_PROTECTION: {
        title: "예약 보호 가이드",
        items: [
            {
                action: "예약 중단/재개",
                when: "태풍, 호우 등 기상 악화나 캠핑장 내부 사정으로 신규 예약을 잠시 막아야 할 때 사용하세요.",
                what: "새로운 예약만 막히고, 기존 예약 정보 확인이나 관리는 가능합니다.",
                caution: "이미 예약된 손님에게는 별도로 연락해야 합니다."
            },
            {
                action: "오늘 예약 마감",
                when: "오늘 남은 사이트를 더 이상 받고 싶지 않을 때 (현장 마감 등) 사용하세요.",
                what: "오늘 날짜의 모든 잔여 사이트가 '예약 불가' 상태로 변경됩니다.",
                caution: "한 번 마감하면 되돌리기가 번거로우니(개별 수정 필요) 신중히 눌러주세요."
            }
        ]
    },
    SYSTEM_RECOVERY: {
        title: "시스템 복구 가이드",
        items: [
            {
                action: "캐시 초기화",
                when: "날씨 정보나 공지사항을 수정했는데 홈 화면에 바로 안 보일 때 사용하세요.",
                what: "임시 저장된 데이터(캐시)를 싹 지우고 새로 불러옵니다.",
                caution: "너무 자주 누르면 서버가 조금 느려질 수 있습니다."
            },
            {
                action: "알림 큐 비우기",
                when: "잘못된 알림이 대량으로 발송 대기 중일 때 급하게 취소하려면 사용하세요.",
                what: "아직 발송되지 않은 '대기 중' 상태의 푸시 알림을 모두 취소합니다.",
                caution: "이미 발송된 알림은 취소할 수 없습니다."
            }
        ]
    }
};

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

// 도움말 버튼 컴포넌트
function HelpButton({ guideKey }: { guideKey: keyof typeof HELP_GUIDES }) {
    const guide = HELP_GUIDES[guideKey];

    return (
        <Dialog>
            <DialogTrigger asChild>
                <button className="text-gray-400 hover:text-blue-500 transition-colors p-1 rounded-full hover:bg-blue-50">
                    <HelpCircle size={18} />
                </button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{guide.title}</DialogTitle>
                    <DialogDescription>
                        각 버튼의 용도와 주의사항을 확인하세요.
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-6 mt-4">
                    {guide.items.map((item, idx) => (
                        <div key={idx} className="space-y-2">
                            <h4 className="font-semibold text-gray-900 flex items-center gap-2">
                                <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                                {item.action}
                            </h4>
                            <div className="pl-3.5 space-y-2 text-sm text-gray-600">
                                <p><span className="font-medium text-gray-700">언제 쓰나요?</span><br />{item.when}</p>
                                <p><span className="font-medium text-gray-700">효과는?</span><br />{item.what}</p>
                                <div className="bg-yellow-50 p-3 rounded-lg text-yellow-800 text-xs">
                                    <span className="font-bold">⚠️ 주의:</span> {item.caution}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </DialogContent>
        </Dialog>
    );
}

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
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="font-semibold flex items-center gap-2">
                            <Shield size={18} className="text-blue-500" />
                            서비스 보호
                        </h3>
                        <HelpButton guideKey="SERVICE_PROTECTION" />
                    </div>
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
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="font-semibold flex items-center gap-2">
                            <Calendar size={18} className="text-green-500" />
                            예약 보호
                        </h3>
                        <HelpButton guideKey="RESERVATION_PROTECTION" />
                    </div>
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
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="font-semibold flex items-center gap-2">
                            <RefreshCw size={18} className="text-orange-500" />
                            시스템 복구
                        </h3>
                        <HelpButton guideKey="SYSTEM_RECOVERY" />
                    </div>
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
