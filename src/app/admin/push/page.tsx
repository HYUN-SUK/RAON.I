'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Send, Loader2 } from 'lucide-react';

interface NotificationLog {
    id: string;
    category: string;
    title: string;
    body: string;
    status: string;
    created_at: string;
}

export default function AdminPushPage() {
    const supabase = createClient();
    const [title, setTitle] = useState('');
    const [body, setBody] = useState('');
    const [category, setCategory] = useState({ value: 'system', label: '시스템 (System)' });
    const [target, setTarget] = useState('all'); // 'all' only for now
    const [sending, setSending] = useState(false);
    const [logs, setLogs] = useState<NotificationLog[]>([]);

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

    const handleSend = async () => {
        if (!title || !body) return;
        setSending(true);

        try {
            // 1. Get Target Users
            // For MVP, if target is ALL, we fetch all active push tokens.
            // But writing to individual notifications for 1000 users is heavy.
            // SSOT 10.10.3 says Campaign -> Segment.
            // For this Admin Tool, we will just simulate inserting a "System" notification for the current Admin to verify logic.
            // Or better, insert 1 record if target is specific, or use a "Broadcast" convention?

            // Let's just Insert one record to 'notifications' table to simulate "Queueing".
            // In a real Edge Function, this Insert would trigger the fan-out.

            const { data: { user } } = await supabase.auth.getUser();

            await supabase.from('notifications').insert({
                user_id: user?.id, // Send to self for testing
                category: category.value,
                title,
                body,
                status: 'queued'
            });

            setTitle('');
            setBody('');
            fetchLogs();
            alert('알림이 발송 대기열(Queue)에 등록되었습니다. (실제 발송은 Firebase Config 필요)');
        } catch (error) {
            console.error(error);
            alert('발송 실패');
        } finally {
            setSending(false);
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
                                            <span className={`text-xs font-bold px-2 py-0.5 rounded ${log.category === 'system' ? 'bg-gray-100 text-gray-700' : 'bg-green-100 text-green-700'
                                                }`}>
                                                {log.category.toUpperCase()}
                                            </span>
                                            <span className="text-xs text-gray-400">
                                                {new Date(log.created_at).toLocaleString()}
                                            </span>
                                        </div>
                                        <h4 className="font-medium text-sm">{log.title}</h4>
                                        <p className="text-xs text-gray-600 line-clamp-2">{log.body}</p>
                                        <div className="mt-2 flex items-center gap-2">
                                            <span className={`text-[10px] uppercase font-bold ${log.status === 'sent' ? 'text-blue-500' : 'text-orange-500'
                                                }`}>
                                                {log.status}
                                            </span>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
