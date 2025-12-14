'use client';

import * as React from 'react';
import { DayPicker, DateRange } from 'react-day-picker';
import { ko } from 'date-fns/locale';
import { format } from 'date-fns';
import { useReservationStore } from '@/store/useReservationStore';
import { SITES } from '@/constants/sites';
import { BlockedDate } from '@/types/reservation';
import { Trash2, AlertCircle } from 'lucide-react';
import 'react-day-picker/style.css';

export default function BlockDateScheduler() {
    const { blockedDates, addBlockDate, removeBlockDate } = useReservationStore();
    const [selectedRange, setSelectedRange] = React.useState<DateRange | undefined>();
    const [selectedSites, setSelectedSites] = React.useState<string[]>([]);
    const [memo, setMemo] = React.useState('');

    const handleSelect = (range: DateRange | undefined) => {
        setSelectedRange(range);
    };

    const handleSiteToggle = (siteId: string) => {
        setSelectedSites(prev =>
            prev.includes(siteId)
                ? prev.filter(id => id !== siteId)
                : [...prev, siteId]
        );
    };

    const handleBlock = () => {
        if (!selectedRange?.from || selectedSites.length === 0) {
            alert('날짜와 사이트를 선택해주세요.');
            return;
        }

        const start = selectedRange.from;
        const end = selectedRange.to || selectedRange.from;
        const days = [];
        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
            days.push(new Date(d));
        }

        days.forEach(date => {
            selectedSites.forEach(siteId => {
                const newBlock: BlockedDate = {
                    id: Math.random().toString(36).substr(2, 9),
                    siteId,
                    date: new Date(date),
                    memo
                };
                addBlockDate(newBlock);
            });
        });

        alert('차단 설정이 완료되었습니다.');
        setSelectedRange(undefined);
        setSelectedSites([]);
        setMemo('');
    };

    const handleDelete = (id: string) => {
        if (confirm('차단을 해제하시겠습니까?')) {
            removeBlockDate(id);
        }
    };

    // Filter blocked dates for display
    const blockedModifiers = {
        blocked: blockedDates.map(b => new Date(b.date))
    };

    const blockedStyle = {
        blocked: { color: 'red', fontWeight: 'bold' as 'bold' }
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-stone-200">
                <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                    <span className="text-red-500">🚫</span> 예약 차단 설정
                </h2>

                <DayPicker
                    mode="range"
                    selected={selectedRange}
                    onSelect={handleSelect}
                    locale={ko}
                    modifiers={blockedModifiers}
                    modifiersStyles={blockedStyle}
                    className="mx-auto border border-stone-100 rounded-xl p-4"
                />

                <div className="mt-6 space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-stone-700 mb-2">차단할 사이트 선택</label>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                            <button
                                onClick={() => setSelectedSites(SITES.map(s => s.id))}
                                className="px-3 py-2 text-xs font-bold rounded-lg border border-stone-200 hover:bg-stone-50"
                            >
                                전체 선택
                            </button>
                            {SITES.map(site => (
                                <button
                                    key={site.id}
                                    onClick={() => handleSiteToggle(site.id)}
                                    className={`
                                        px-3 py-2 text-xs rounded-lg border transition-colors
                                        ${selectedSites.includes(site.id)
                                            ? 'bg-red-500 text-white border-red-500'
                                            : 'border-stone-200 text-stone-600 hover:bg-stone-50'}
                                    `}
                                >
                                    {site.name}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-stone-700 mb-2">차단 사유 (선택)</label>
                        <input
                            type="text"
                            value={memo}
                            onChange={(e) => setMemo(e.target.value)}
                            className="w-full px-4 py-2 border border-stone-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500/20"
                            placeholder="예: 시설 보수 공사"
                        />
                    </div>

                    <button
                        onClick={handleBlock}
                        className="w-full py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl transition-colors shadow-sm"
                    >
                        차단 적용하기
                    </button>
                </div>
            </div>

            <div className="bg-white p-6 rounded-2xl shadow-sm border border-stone-200">
                <h2 className="text-lg font-bold mb-4">현재 차단 목록</h2>
                <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2">
                    {blockedDates.length === 0 ? (
                        <div className="text-center py-10 text-stone-400">
                            <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
                            <p>설정된 차단일이 없습니다.</p>
                        </div>
                    ) : (
                        blockedDates.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()).map(block => {
                            const siteName = SITES.find(s => s.id === block.siteId)?.name || 'Unknown';
                            return (
                                <div key={block.id} className="flex items-center justify-between p-3 bg-stone-50 rounded-lg border border-stone-100">
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm font-bold text-stone-800">
                                                {format(new Date(block.date), 'yyyy.MM.dd (eee)', { locale: ko })}
                                            </span>
                                            <span className="px-2 py-0.5 bg-white border border-stone-200 rounded text-xs text-stone-600">
                                                {siteName}
                                            </span>
                                        </div>
                                        {block.memo && <p className="text-xs text-stone-500 mt-1">{block.memo}</p>}
                                    </div>
                                    <button
                                        onClick={() => handleDelete(block.id)}
                                        className="p-2 text-stone-400 hover:text-red-500 hover:bg-white rounded-full transition-colors"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            )
                        })
                    )}
                </div>
            </div>
        </div>
    );
}
