"use client";

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Calendar, Grid, List } from 'lucide-react';
import { getMyRecords, CampingRecord } from '@/actions/record';
import AjiitCard from '@/components/record/AjiitCard';
import { cn } from '@/lib/utils';

export default function SeasonalRecordsPage() {
    const router = useRouter();
    const [records, setRecords] = useState<CampingRecord[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [activeSeason, setActiveSeason] = useState<string>('all');

    useEffect(() => {
        async function load() {
            try {
                const data = await getMyRecords(100, 0); // Fetch plenty
                setRecords(data);
            } catch (e) {
                console.error(e);
            } finally {
                setIsLoading(false);
            }
        }
        load();
    }, []);

    // Group by Season
    const getSeason = (dateStr: string) => {
        const month = new Date(dateStr).getMonth() + 1;
        if (month >= 3 && month <= 5) return 'spring';
        if (month >= 6 && month <= 8) return 'summer';
        if (month >= 9 && month <= 11) return 'autumn';
        return 'winter';
    };

    const grouped = records.reduce((acc, record) => {
        const season = getSeason(record.start_date);
        if (!acc[season]) acc[season] = [];
        acc[season].push(record);
        return acc;
    }, {} as Record<string, CampingRecord[]>);

    const seasons = [
        { id: 'spring', label: '봄', color: 'text-pink-600 bg-pink-50', icon: '🌸' },
        { id: 'summer', label: '여름', color: 'text-green-600 bg-green-50', icon: '🌿' },
        { id: 'autumn', label: '가을', color: 'text-orange-600 bg-orange-50', icon: '🍁' },
        { id: 'winter', label: '겨울', color: 'text-blue-600 bg-blue-50', icon: '❄️' },
    ];

    return (
        <div className="min-h-screen bg-[#F0EBE0] dark:bg-[#1a1a1a] pb-20 font-serif relative">
            <div className="fixed inset-0 pointer-events-none opacity-30 mix-blend-multiply bg-[url('https://www.transparenttextures.com/patterns/cream-paper.png')]"></div>

            {/* Header */}
            <header className="sticky top-0 z-50 bg-[#F0EBE0]/90 dark:bg-[#1a1a1a]/90 backdrop-blur-md px-4 h-14 flex items-center justify-between border-b border-stone-300 dark:border-stone-800">
                <div className="flex items-center gap-3">
                    <button onClick={() => router.back()} className="p-2 -ml-2 rounded-full hover:bg-stone-200/50">
                        <ArrowLeft className="w-5 h-5 text-stone-700 dark:text-stone-300" />
                    </button>
                    <h1 className="font-bold text-lg text-[#2C2C2C] dark:text-stone-200 font-serif">계절별 기록</h1>
                </div>

                {/* View Switcher */}
                <div className="flex bg-stone-200/50 rounded-lg p-0.5">
                    <button onClick={() => router.replace('/myspace/records')} className="p-1.5 text-stone-400 hover:text-stone-600">
                        <List className="w-4 h-4" />
                    </button>
                    <button className="p-1.5 bg-white text-[#1C4526] shadow-sm rounded-md">
                        <Grid className="w-4 h-4" />
                    </button>
                    <button onClick={() => router.replace('/myspace/records/timeline')} className="p-1.5 text-stone-400 hover:text-stone-600">
                        <Calendar className="w-4 h-4" />
                    </button>
                </div>
            </header>

            <main className="px-5 pt-6 space-y-8 relative z-10">
                {seasons.map((season) => {
                    const seasonRecords = grouped[season.id] || [];
                    if (seasonRecords.length === 0) return null;

                    return (
                        <section key={season.id} className="space-y-4">
                            <div className="flex items-center gap-2">
                                <span className="text-2xl">{season.icon}</span>
                                <h3 className={cn("text-lg font-bold px-3 py-1 rounded-full", season.color)}>
                                    {season.label}의 추억 ({seasonRecords.length})
                                </h3>
                            </div>

                            <div className="grid grid-cols-1 gap-6">
                                {seasonRecords.map(record => (
                                    <AjiitCard
                                        key={record.id}
                                        record={{
                                            ...record,
                                            campground_name: record.campground_name,
                                            campground_address: record.campground_address
                                        }}
                                    />
                                ))}
                            </div>
                        </section>
                    );
                })}

                {!isLoading && records.length === 0 && (
                    <div className="py-20 text-center text-stone-400">
                        <p>아직 기록이 없어요.</p>
                    </div>
                )}
            </main>
        </div>
    );
}
