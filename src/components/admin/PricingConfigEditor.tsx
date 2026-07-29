'use client';

import { useReservationStore } from '@/store/useReservationStore';
import { PricingConfig, Season } from '@/types/reservation';
import { useState, useEffect } from 'react';
import { Save, Plus, Trash2, Loader2, CheckCircle2 } from 'lucide-react';
import { getPricingConfigAction, updatePricingConfigAction } from '@/actions/admin-pricing';

export default function PricingConfigEditor() {
    const { priceConfig, setPriceConfig } = useReservationStore();
    const [config, setConfig] = useState<PricingConfig>(priceConfig);
    const [isDirty, setIsDirty] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    // 1. Fetch live pricing config from DB on mount
    useEffect(() => {
        let isMounted = true;
        const loadConfig = async () => {
            setIsLoading(true);
            const res = await getPricingConfigAction();
            if (res.success && res.data && isMounted) {
                setConfig(res.data);
                setPriceConfig(res.data);
            }
            if (isMounted) setIsLoading(false);
        };
        loadConfig();
        return () => { isMounted = false; };
    }, [setPriceConfig]);

    const handleChange = (field: keyof PricingConfig, value: number) => {
        setConfig(prev => ({ ...prev, [field]: value }));
        setIsDirty(true);
    };

    const handleSeasonChange = (index: number, field: keyof Season, value: any) => {
        const newSeasons = [...config.seasons];
        newSeasons[index] = { ...newSeasons[index], [field]: value };
        setConfig(prev => ({ ...prev, seasons: newSeasons }));
        setIsDirty(true);
    };

    const addSeason = () => {
        const newSeason: Season = { name: 'New Season', startMonth: 6, startDay: 1, endMonth: 9, endDay: 30 };
        setConfig(prev => ({ ...prev, seasons: [...prev.seasons, newSeason] }));
        setIsDirty(true);
    };

    const removeSeason = (index: number) => {
        setConfig(prev => ({ ...prev, seasons: prev.seasons.filter((_, i) => i !== index) }));
        setIsDirty(true);
    };

    const handleSave = async () => {
        setIsSaving(true);
        const result = await updatePricingConfigAction(config);
        setIsSaving(false);

        if (result.success) {
            setPriceConfig(config);
            setIsDirty(false);
            alert('가격 및 성수기 설정이 DB에 성공적으로 저장되었습니다!\n모든 사용자 앱 화면에 즉시 동적 적용됩니다.');
        } else {
            alert(`저장 중 오류가 발생했습니다: ${result.error}`);
        }
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center p-12 text-stone-500 gap-2">
                <Loader2 className="animate-spin" size={24} />
                <span>DB 가격/성수기 정책 로딩 중...</span>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Top Fixed Save Bar */}
            <div className="bg-[#224732] text-white p-4 rounded-2xl shadow-sm flex items-center justify-between">
                <div>
                    <h2 className="font-bold text-base md:text-lg flex items-center gap-2">
                        <CheckCircle2 size={20} className="text-emerald-400" />
                        가격 및 성수기 관리 (DB 실시간 동기화)
                    </h2>
                    <p className="text-xs text-stone-300 mt-0.5">
                        여기서 변경하고 아래 <strong>[DB 저장하기]</strong> 버튼을 누르면 즉시 전체 시스템에 반영됩니다.
                    </p>
                </div>
                <button
                    onClick={handleSave}
                    disabled={isSaving}
                    className="bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-white px-5 py-2.5 rounded-xl font-bold shadow-md transition-all flex items-center gap-2 touch-manipulation disabled:opacity-50"
                >
                    {isSaving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                    <span>{isSaving ? '저장 중...' : '💾 DB에 저장하기'}</span>
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Base Prices */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-stone-200">
                    <h3 className="text-lg font-bold mb-4 text-stone-800">기본 요금 설정</h3>
                    <div className="space-y-4">
                        <NumberInput label="평일 기본가" value={config.weekday} onChange={(v) => handleChange('weekday', v)} />
                        <NumberInput label="주말(금/토/일/공휴일) 기본가" value={config.weekend} onChange={(v) => handleChange('weekend', v)} />
                        <div className="h-px bg-stone-100 my-4" />
                        <NumberInput label="성수기 평일" value={config.peakWeekday} onChange={(v) => handleChange('peakWeekday', v)} />
                        <NumberInput label="성수기 주말" value={config.peakWeekend} onChange={(v) => handleChange('peakWeekend', v)} />
                    </div>
                </div>

                {/* Rules */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-stone-200">
                    <h3 className="text-lg font-bold mb-4 text-stone-800">추가 옵션 및 할인</h3>
                    <div className="space-y-4">
                        <NumberInput label="추가 가족 (1박당)" value={config.extraFamily} onChange={(v) => handleChange('extraFamily', v)} />
                        <NumberInput label="방문객 (1인 1회)" value={config.visitor} onChange={(v) => handleChange('visitor', v)} />
                        <div className="h-px bg-stone-100 my-4" />
                        <NumberInput label="연박 할인 (박당 차감액)" value={config.longStayDiscount} onChange={(v) => handleChange('longStayDiscount', v)} />
                        <p className="text-xs text-stone-400">* 주말 연박(2박 이상) 시 적용됩니다.</p>
                    </div>
                </div>

                {/* Seasons */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-stone-200 md:col-span-2">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-lg font-bold text-stone-800">성수기 시즌 관리</h3>
                        <button onClick={addSeason} className="flex items-center gap-1 text-sm bg-stone-100 hover:bg-stone-200 px-3 py-2 rounded-lg transition-colors">
                            <Plus size={16} /> 추가
                        </button>
                    </div>

                    <div className="space-y-4">
                        {config.seasons.map((season, idx) => (
                            <div key={idx} className="flex flex-wrap md:flex-nowrap items-end gap-3 p-4 bg-stone-50 rounded-xl border border-stone-100">
                                <div className="w-full md:w-auto flex-grow">
                                    <label className="text-xs font-semibold text-stone-500 mb-1 block">시즌명</label>
                                    <input
                                        type="text"
                                        value={season.name}
                                        onChange={(e) => handleSeasonChange(idx, 'name', e.target.value)}
                                        className="w-full px-3 py-2 text-sm border rounded-lg"
                                    />
                                </div>
                                <div className="flex items-center gap-2">
                                    <DateInput
                                        month={season.startMonth} day={season.startDay}
                                        onMonthChange={(v) => handleSeasonChange(idx, 'startMonth', v)}
                                        onDayChange={(v) => handleSeasonChange(idx, 'startDay', v)}
                                    />
                                    <span className="text-stone-400">~</span>
                                    <DateInput
                                        month={season.endMonth} day={season.endDay}
                                        onMonthChange={(v) => handleSeasonChange(idx, 'endMonth', v)}
                                        onDayChange={(v) => handleSeasonChange(idx, 'endDay', v)}
                                    />
                                </div>
                                <button onClick={() => removeSeason(idx)} className="p-2 text-stone-400 hover:text-red-500">
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Bottom Fixed Action Button Bar */}
            <div className="pt-4 flex justify-end">
                <button
                    onClick={handleSave}
                    disabled={isSaving}
                    className="w-full md:w-auto bg-[#224732] hover:bg-[#1a3b20] active:scale-95 text-white px-8 py-4 rounded-xl font-bold shadow-lg transition-all flex items-center justify-center gap-2 touch-manipulation text-base disabled:opacity-50"
                >
                    {isSaving ? <Loader2 size={20} className="animate-spin" /> : <Save size={20} />}
                    <span>{isSaving ? '저장 처리 중...' : '💾 가격 및 성수기 설정 저장하기'}</span>
                </button>
            </div>
        </div>
    );
}

function NumberInput({ label, value, onChange }: { label: string, value: number, onChange: (v: number) => void }) {
    return (
        <div>
            <label className="block text-sm font-medium text-stone-600 mb-1">{label}</label>
            <div className="relative">
                <input
                    type="number"
                    value={value}
                    onChange={(e) => onChange(Number(e.target.value))}
                    className="w-full pl-3 pr-8 py-2 border border-stone-200 rounded-lg text-sm text-right font-mono"
                />
                <span className="absolute right-3 top-2 text-xs text-stone-400">원</span>
            </div>
        </div>
    );
}

function DateInput({ month, day, onMonthChange, onDayChange }: { month: number, day: number, onMonthChange: (v: number) => void, onDayChange: (v: number) => void }) {
    return (
        <div className="flex gap-1">
            <select value={month} onChange={(e) => onMonthChange(Number(e.target.value))} className="px-2 py-2 border rounded-lg text-sm bg-white">
                {Array.from({ length: 12 }, (_, i) => i + 1).map(m => <option key={m} value={m}>{m}월</option>)}
            </select>
            <select value={day} onChange={(e) => onDayChange(Number(e.target.value))} className="px-2 py-2 border rounded-lg text-sm bg-white">
                {Array.from({ length: 31 }, (_, i) => i + 1).map(d => <option key={d} value={d}>{d}일</option>)}
            </select>
        </div>
    );
}
