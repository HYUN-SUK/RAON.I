'use client';

import React, { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { CalendarClock, Save, Loader2, CalendarRange, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';

interface OpenDayRule {
    id: string;
    season_name: string | null;
    open_at: string;
    close_at: string;
    is_active: boolean;
    repeat_rule: 'NONE' | 'MONTHLY';
    automation_config?: {
        triggerDay: number;
        monthsToAdd: number;
        targetDay: 'END' | number;
    } | null;
}

export default function OpenDayConfig() {
    const supabase = createClient();
    const [loading, setLoading] = useState(false);
    const [initialLoading, setInitialLoading] = useState(true);

    // Form State
    const [seasonName, setSeasonName] = useState('');
    const [repeatRule, setRepeatRule] = useState<'NONE' | 'MONTHLY'>('NONE');

    // Manual Mode State
    const [openAt, setOpenAt] = useState('');
    const [closeAt, setCloseAt] = useState('');

    // Automation Mode State
    const [monthsToAdd, setMonthsToAdd] = useState('2');
    const [targetDay, setTargetDay] = useState('END');

    // Current Rule State
    const [currentRule, setCurrentRule] = useState<OpenDayRule | null>(null);

    const fetchCurrentRule = async () => {
        try {
            const { data, error } = await supabase
                .from('open_day_rules')
                .select('*')
                .eq('is_active', true)
                .maybeSingle();

            if (error) throw error;

            if (data) {
                setCurrentRule(data);
                setSeasonName(data.season_name || '');
                // Note: We don't pre-fill form to avoid confusion unless editing,
                // but for Auto mode persistence, we might want to check the previous rule style?
                // Let's keep form separate for "New Rule".
            }
        } catch (error) {
            console.error('Error fetching open day rule:', error);
        } finally {
            setInitialLoading(false);
        }
    };

    useEffect(() => {
        fetchCurrentRule();
    }, []);

    const handleSave = async () => {
        setLoading(true);

        try {
            let insertData: any = {
                season_name: seasonName || (repeatRule === 'MONTHLY' ? '매월 자동 오픈' : '새 시즌'),
                is_active: true,
                repeat_rule: repeatRule
            };

            if (repeatRule === 'NONE') {
                if (!openAt || !closeAt) {
                    toast.error('오픈일과 종료일을 모두 지정해주세요.');
                    setLoading(false);
                    return;
                }
                if (new Date(openAt) >= new Date(closeAt)) {
                    toast.error('종료일은 오픈일보다 이후여야 합니다.');
                    setLoading(false);
                    return;
                }
                insertData.open_at = new Date(openAt).toISOString();
                insertData.close_at = new Date(closeAt).toISOString();
                insertData.automation_config = null;
            } else {
                // MONTHLY AUTOMATION
                // open_at acts as "Automation Start Date" (Now)
                // close_at acts as "Far Future" (or initial calculation)
                // Actually, store generic future date to allow "isOpen" checks to pass initially if logic fails
                const now = new Date();
                insertData.open_at = now.toISOString();
                insertData.close_at = new Date('2099-12-31').toISOString(); // Infinite window, logic controls actual range

                insertData.automation_config = {
                    triggerDay: 1, // Fixed to 1st of month 09:00 as per requirement
                    monthsToAdd: parseInt(monthsToAdd),
                    targetDay: targetDay
                };
            }

            // 1. Insert new rule (Trigger will auto-deactivate old ones)
            const { error } = await supabase
                .from('open_day_rules')
                .insert(insertData);

            if (error) throw error;

            toast.success(repeatRule === 'MONTHLY' ? '자동 오픈 규칙이 설정되었습니다.' : '예약 오픈일이 설정되었습니다.');

            // Reset Form (Optional, keeping values might be better for tweaks? Let's clear)
            setOpenAt('');
            setCloseAt('');
            // Don't clear Monthly settings as they are configs
            fetchCurrentRule();

        } catch (error: any) {
            console.error('Save failed:', error);
            toast.error('설정 저장 실패: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Card className="border-l-4 border-l-[#1C4526] shadow-sm">
            <CardHeader className="pb-4">
                <div className="flex items-center gap-2">
                    <CalendarClock className="w-5 h-5 text-[#1C4526]" />
                    <CardTitle className="text-lg">예약 오픈일 관리</CardTitle>
                </div>
                <CardDescription>
                    다음 시즌 예약 오픈 날짜와 마감 날짜를 설정합니다. 설정 시 즉시 반영됩니다.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                {/* Current Status Display */}
                <div className="bg-gray-50 p-4 rounded-lg flex items-start gap-3 border">
                    <CalendarRange className="w-5 h-5 text-gray-500 mt-0.5" />
                    <div>
                        <h4 className="font-semibold text-sm text-gray-700">현재 적용 중인 시즌</h4>
                        {initialLoading ? (
                            <Loader2 className="w-4 h-4 animate-spin mt-1" />
                        ) : currentRule ? (
                            <div className="mt-1 text-sm">
                                <p className="font-medium text-[#1C4526]">
                                    {currentRule.season_name}
                                    {currentRule.repeat_rule === 'MONTHLY' && (
                                        <span className="ml-2 bg-blue-100 text-blue-800 text-xs px-2 py-0.5 rounded-full">자동 반복</span>
                                    )}
                                </p>
                                {currentRule.repeat_rule === 'MONTHLY' && currentRule.automation_config ? (
                                    <div className="mt-1 text-gray-600 space-y-1">
                                        <p>매월 1일 09:00 오픈</p>
                                        <p>
                                            범위: 현재 월 +
                                            <span className="font-bold text-[#1C4526] mx-1">{currentRule.automation_config.monthsToAdd}개월</span>
                                            뒤
                                            <span className="font-bold text-[#1C4526] mx-1">{currentRule.automation_config.targetDay === 'END' ? '말일' : `${currentRule.automation_config.targetDay}일`}</span>
                                            까지
                                        </p>
                                    </div>
                                ) : (
                                    <>
                                        <p className="text-gray-600 mt-1">
                                            오픈: {format(new Date(currentRule.open_at), 'yyyy년 M월 d일 HH:mm', { locale: ko })}
                                        </p>
                                        <p className="text-gray-600">
                                            종료: {format(new Date(currentRule.close_at), 'yyyy년 M월 d일 HH:mm', { locale: ko })}
                                        </p>
                                    </>
                                )}
                                <div className="mt-2 flex items-center gap-1.5 text-xs">
                                    {/* Simple Status Badge */}
                                    <span className={`px-2 py-0.5 rounded-full ${currentRule.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
                                        {currentRule.is_active ? '진행 중' : '비활성'}
                                    </span>
                                </div>
                            </div>
                        ) : (
                            <p className="text-sm text-gray-500 mt-1">설정된 시즌이 없습니다. 예약이 불가능할 수 있습니다.</p>
                        )}
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label>설정 모드</Label>
                        <div className="flex gap-2">
                            <Button
                                type="button"
                                variant={repeatRule === 'NONE' ? 'default' : 'outline'}
                                onClick={() => setRepeatRule('NONE')}
                                className={repeatRule === 'NONE' ? 'bg-[#1C4526]' : ''}
                            >
                                수동 날짜 지정
                            </Button>
                            <Button
                                type="button"
                                variant={repeatRule === 'MONTHLY' ? 'default' : 'outline'}
                                onClick={() => setRepeatRule('MONTHLY')}
                                className={repeatRule === 'MONTHLY' ? 'bg-[#1C4526]' : ''}
                            >
                                매월 자동 반복
                            </Button>
                        </div>
                    </div>
                    <div className="space-y-2">
                        <Label>시즌 이름 (선택)</Label>
                        <Input
                            placeholder={repeatRule === 'MONTHLY' ? "예: 2026 시즌 (자동)" : "예: 2026 봄 시즌"}
                            value={seasonName}
                            onChange={(e) => setSeasonName(e.target.value)}
                        />
                    </div>

                    {repeatRule === 'NONE' ? (
                        <>
                            <div className="space-y-2">
                                <Label>예약 오픈 일시</Label>
                                <Input
                                    type="datetime-local"
                                    value={openAt}
                                    onChange={(e) => setOpenAt(e.target.value)}
                                />
                                <p className="text-xs text-gray-500">이 시간부터 사용자에게 예약이 허용됩니다.</p>
                            </div>

                            <div className="space-y-2">
                                <Label>예약 마감 일시</Label>
                                <Input
                                    type="datetime-local"
                                    value={closeAt}
                                    onChange={(e) => setCloseAt(e.target.value)}
                                />
                                <p className="text-xs text-gray-500">이 시간 이후로는 예약이 차단됩니다.</p>
                            </div>
                        </>
                    ) : (
                        <div className="col-span-1 md:col-span-2 bg-[#F7F5EF] p-4 rounded-lg border border-[#EBE8E0]">
                            <h5 className="font-semibold text-sm mb-3 text-[#1C4526] flex items-center gap-2">
                                <CalendarClock className="w-4 h-4" />
                                자동 오픈 규칙 설정
                            </h5>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <Label className="text-xs uppercase tracking-wider text-gray-500">오픈 트리거</Label>
                                    <div className="p-3 bg-white rounded border border-gray-200 text-sm font-medium text-gray-700">
                                        매월 1일 오전 09:00
                                    </div>
                                    <p className="text-[11px] text-gray-400">오픈 시간은 현재 고정값입니다.</p>
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-xs uppercase tracking-wider text-gray-500">예약 가능 기간 자동 계산</Label>
                                    <div className="flex items-center gap-2">
                                        <select
                                            className="h-10 w-20 rounded-md border border-input bg-white px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                                            value={monthsToAdd}
                                            onChange={(e) => setMonthsToAdd(e.target.value)}
                                        >
                                            {[1, 2, 3, 4, 5, 6].map(m => (
                                                <option key={m} value={m}>{m}개월</option>
                                            ))}
                                        </select>
                                        <span className="text-sm font-medium">뒤</span>

                                        <select
                                            className="h-10 w-24 rounded-md border border-input bg-white px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                                            value={targetDay}
                                            onChange={(e) => setTargetDay(e.target.value)}
                                        >
                                            <option value="END">말일</option>
                                            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 15, 20, 25].map(d => (
                                                <option key={d} value={d}>{d}일</option>
                                            ))}
                                        </select>
                                        <span className="text-sm font-medium">까지 오픈</span>
                                    </div>
                                    <p className="text-[11px] text-blue-600">
                                        예: 현재 1월 15일 → 3월 말일까지 오픈됨 (기간 연장)
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                <div className="pt-2 flex justify-end">
                    <Button onClick={handleSave} disabled={loading} className="bg-[#1C4526] hover:bg-[#15341d]">
                        {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                        {repeatRule === 'MONTHLY' ? '자동 규칙 저장' : '오픈일 설정 저장'}
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
}
