'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Send, Loader2, Bell, TestTube } from 'lucide-react';
import { notificationService } from '@/services/notificationService';
import { NotificationEventType } from '@/types/notificationEvents';
import { toast } from 'sonner';

interface NotificationLog {
    id: string;
    category: string;
    title: string;
    body: string;
    status: string;
    created_at: string;
    event_type?: string;
}

// 이벤트 타입 옵션 (테스트용)
const EVENT_OPTIONS = [
    { value: NotificationEventType.RESERVATION_CONFIRMED, label: '예약 확정 (푸시 O)', push: true },
    { value: NotificationEventType.DEPOSIT_CONFIRMED, label: '입금 확인 (푸시 O)', push: true },
    { value: NotificationEventType.UPCOMING_STAY_D1, label: 'D-1 안내 (푸시 O)', push: true },
    { value: NotificationEventType.WAITLIST_SLOT_OPENED, label: '빈자리 알림 (푸시 O)', push: true },
    { value: NotificationEventType.COMMUNITY_LIKE, label: '커뮤니티 좋아요 (배지만)', push: false },
    { value: NotificationEventType.COMMUNITY_COMMENT, label: '커뮤니티 댓글 (배지만)', push: false },
    { value: NotificationEventType.MISSION_REWARD, label: '미션 보상 (배지만)', push: false },
];

export default function AdminPushPage() {
    const supabase = createClient();
    const [title, setTitle] = useState('');
    const [body, setBody] = useState('');
    const [category, setCategory] = useState({ value: 'system', label: '시스템 (System)' });
    const [target, setTarget] = useState('all');
    const [sending, setSending] = useState(false);
    const [logs, setLogs] = useState<NotificationLog[]>([]);

    // 이벤트 테스트용 상태
    const [testEventType, setTestEventType] = useState<NotificationEventType>(NotificationEventType.RESERVATION_CONFIRMED);
    const [testLoading, setTestLoading] = useState(false);

    useEffect(() => {
        fetchLogs();
    }, []);

    const fetchLogs = async () => {
        const { data } = await supabase
            .from('notifications')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(20);
        if (data) setLogs(data);
    };

    // 기존 수동 발송
    const handleSend = async () => {
        if (!title || !body) return;
        setSending(true);

        try {
            const { data: { user } } = await supabase.auth.getUser();

            await supabase.from('notifications').insert({
                user_id: user?.id,
                category: category.value,
                title,
                body,
                status: 'queued'
            });

            setTitle('');
            setBody('');
            fetchLogs();
            toast.success('알림이 발송 대기열에 등록되었습니다.');
        } catch (error) {
            console.error(error);
            toast.error('발송 실패');
        } finally {
            setSending(false);
        }
    };

    // 이벤트 기반 알림 테스트
    const handleEventTest = async () => {
        setTestLoading(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                toast.error('로그인이 필요합니다.');
                return;
            }

            // 테스트 데이터
            const testData: Record<string, string> = {
                siteName: '솔향이네',
                checkIn: '2026-01-10',
                checkOut: '2026-01-12',
                checkInTime: '14:00',
                targetDate: '2026-01-15',
                userName: '테스트유저',
                preview: '정말 좋은 글이에요!',
                reward: '100',
                message: '테스트 메시지입니다.',
                status: '배송중',
            };

            const result = await notificationService.dispatchNotification(
                testEventType,
                user.id,
                testData
            );

            if (result.success) {
                toast.success(`알림 발송 완료 (방식: ${result.method === 'push' ? '푸시' : '인앱 배지'})`);
                fetchLogs();
            } else {
                toast.error(`발송 실패: ${result.message}`);
            }
        } catch (error) {
            console.error(error);
            toast.error('테스트 실패');
        } finally {
            setTestLoading(false);
        }
    };

    return (
        <div className="space-y-6">
            <h1 className="text-2xl font-bold">알림 센터 (Notification Center)</h1>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Send Form */}
                <Card>
                    <CardHeader>
                        <CardTitle>알림 발송 (Broadcast)</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium">카테고리</label>
                            <Select
                                value={category.value}
                                onValueChange={(val) => setCategory({ value: val, label: val })}
                            >
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="system">시스템 (System)</SelectItem>
                                    <SelectItem value="reservation">예약 (Reservation)</SelectItem>
                                    <SelectItem value="event">이벤트 (Event)</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium">수신 대상 (Segment)</label>
                            <Select value={target} onValueChange={setTarget}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">전체 사용자 (All Users)</SelectItem>
                                    <SelectItem value="test">테스트 (나에게만)</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium">제목</label>
                            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="알림 제목" />
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium">내용</label>
                            <Textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="알림 내용" rows={4} />
                        </div>

                        <Button className="w-full bg-[#1C4526]" onClick={handleSend} disabled={sending}>
                            {sending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Send className="w-4 h-4 mr-2" />}
                            발송 큐 등록
                        </Button>
                    </CardContent>
                </Card>

                {/* Queue Log */}
                <Card>
                    <CardHeader>
                        <CardTitle>최근 발송 로그 (Queue)</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            {logs.length === 0 ? (
                                <p className="text-gray-500 text-sm">기록이 없습니다.</p>
                            ) : (
                                logs.map(log => (
                                    <div key={log.id} className="border-b pb-4 last:border-0">
                                        <div className="flex justify-between items-start mb-1">
                                            <span className={`text-xs font-bold px-2 py-0.5 rounded ${log.category === 'system' ? 'bg-gray-100 text-gray-700' : 'bg-green-100 text-green-700'}`}>
                                                {log.category.toUpperCase()}
                                            </span>
                                            <span className="text-xs text-gray-400">
                                                {new Date(log.created_at).toLocaleString()}
                                            </span>
                                        </div>
                                        <h4 className="font-medium text-sm">{log.title}</h4>
                                        <p className="text-xs text-gray-600 line-clamp-2">{log.body}</p>
                                        <div className="mt-2 flex items-center gap-2">
                                            <span className={`text-[10px] uppercase font-bold ${log.status === 'sent' ? 'text-blue-500' : 'text-orange-500'}`}>
                                                {log.status}
                                            </span>
                                            {log.event_type && (
                                                <span className="text-[10px] text-gray-400">[{log.event_type}]</span>
                                            )}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* 이벤트 기반 알림 테스트 섹션 */}
            <Card className="border-2 border-dashed border-brand-1/30">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <TestTube className="w-5 h-5 text-brand-1" />
                        이벤트 기반 알림 테스트
                    </CardTitle>
                    <CardDescription>
                        SSOT 정책에 따른 자동 알림 시스템을 테스트합니다.
                        푸시 허용 이벤트는 푸시+배지가 생성되고, 푸시 금지 이벤트는 배지만 생성됩니다.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex flex-col md:flex-row gap-4 items-end">
                        <div className="flex-1 space-y-2">
                            <label className="text-sm font-medium">이벤트 타입</label>
                            <Select
                                value={testEventType}
                                onValueChange={(val) => setTestEventType(val as NotificationEventType)}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {EVENT_OPTIONS.map((opt) => (
                                        <SelectItem key={opt.value} value={opt.value}>
                                            <div className="flex items-center gap-2">
                                                {opt.push ? (
                                                    <Bell className="w-3 h-3 text-green-500" />
                                                ) : (
                                                    <span className="w-2 h-2 rounded-full bg-orange-400" />
                                                )}
                                                {opt.label}
                                            </div>
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <Button
                            onClick={handleEventTest}
                            disabled={testLoading}
                            className="bg-brand-1 hover:bg-brand-1/90"
                        >
                            {testLoading ? (
                                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                            ) : (
                                <TestTube className="w-4 h-4 mr-2" />
                            )}
                            테스트 발송
                        </Button>
                    </div>
                    <div className="mt-4 p-3 bg-gray-50 rounded-lg text-xs text-gray-600">
                        <p className="font-medium mb-1">💡 테스트 안내</p>
                        <ul className="list-disc list-inside space-y-0.5">
                            <li><span className="text-green-600 font-medium">푸시 O</span>: notifications 테이블 + in_app_badges 테이블에 기록</li>
                            <li><span className="text-orange-600 font-medium">배지만</span>: in_app_badges 테이블에만 기록 (하단 네비에 빨간 dot 표시)</li>
                            <li>조용시간(22:00~08:00)에는 일부 푸시가 배지로 대체됩니다.</li>
                        </ul>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
