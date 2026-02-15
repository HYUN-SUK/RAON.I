"use client";

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Calendar, Grid, List, MapPin } from 'lucide-react';
import { getMyRecords, CampingRecord } from '@/actions/record';
import { cn } from '@/lib/utils';
import Image from 'next/image';

export default function TimelineRecordsPage() {
    const router = useRouter();
    const [records, setRecords] = useState<CampingRecord[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        async function load() {
            try {
                const data = await getMyRecords(50, 0);
                setRecords(data);
            } catch (e) {
                console.error(e);
            } finally {
                setIsLoading(false);
            }
        }
        load();
    }, []);

    // Format Date: "2024. 05. 21"
    const formatDate = (dateStr: string) => {
        const d = new Date(dateStr);
        return `${d.getFullYear()}. ${String(d.getMonth() + 1).padStart(2, '0')}. ${String(d.getDate()).padStart(2, '0')}`;
    };

    return (
        <div className="min-h-screen bg-[#F0EBE0] dark:bg-[#1a1a1a] pb-20 font-serif relative">
            <div className="fixed inset-0 pointer-events-none opacity-30 mix-blend-multiply bg-[url('https://www.transparenttextures.com/patterns/cream-paper.png')]"></div>

            {/* Header */}
            <header className="sticky top-0 z-50 bg-[#F0EBE0]/90 dark:bg-[#1a1a1a]/90 backdrop-blur-md px-4 h-14 flex items-center justify-between border-b border-stone-300 dark:border-stone-800">
                <div className="flex items-center gap-3">
                    <button onClick={() => router.back()} className="p-2 -ml-2 rounded-full hover:bg-stone-200/50">
                        <ArrowLeft className="w-5 h-5 text-stone-700 dark:text-stone-300" />
                    </button>
                    <h1 className="font-bold text-lg text-[#2C2C2C] dark:text-stone-200 font-serif">타임라인</h1>
                </div>

                {/* View Switcher */}
                <div className="flex bg-stone-200/50 rounded-lg p-0.5">
                    <button onClick={() => router.replace('/myspace/records')} className="p-1.5 text-stone-400 hover:text-stone-600">
                        <List className="w-4 h-4" />
                    </button>
                    <button onClick={() => router.replace('/myspace/records/seasonal')} className="p-1.5 text-stone-400 hover:text-stone-600">
                        <Grid className="w-4 h-4" />
                    </button>
                    <button className="p-1.5 bg-white text-[#1C4526] shadow-sm rounded-md">
                        <Calendar className="w-4 h-4" />
                    </button>
                </div>
            </header>

            <main className="px-5 pt-10 pb-20 relative z-10 max-w-lg mx-auto">
                <div className="relative border-l-2 border-stone-300 space-y-12 ml-4">
                    {records.map((record, index) => (
                        <div key={record.id} className="relative pl-8">
                            {/* Dot on Line */}
                            <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-[#1C4526] border-4 border-[#F0EBE0] shadow-sm"></div>

                            {/* Date Label */}
                            <div className="absolute -left-20 top-0 text-xs font-bold text-stone-500 text-right w-16">
                                {formatDate(record.start_date)}
                            </div>

                            {/* Card Content */}
                            <div className="bg-white rounded-xl shadow-sm border border-stone-200 overflow-hidden group hover:shadow-md transition-shadow">
                                <div className="p-4 space-y-3">
                                    <div className="flex justify-between items-start">
                                        <h3 className="font-bold text-[#1C4526] text-lg leading-tight">
                                            {record.campground_name}
                                        </h3>
                                        <span className="text-xs px-2 py-0.5 bg-stone-100 text-stone-500 rounded-full">
                                            {record.nights}박 {record.nights + 1}일
                                        </span>
                                    </div>

                                    <div className="flex items-center gap-1 text-xs text-stone-500">
                                        <MapPin className="w-3 h-3" />
                                        {record.campground_address || '주소 정보 없음'}
                                    </div>

                                    {/* Main Image (First image from content if available, or placeholder) */}
                                    {/* Since record structure in DB might not have explicit main_image, we check content or similar. */}
                                    {/* AjiitCard uses image_url or image_urls. CampingRecord type has image_urls? No, it has images jsonb. */}
                                    {/* Let's assume record logic handles it. For now, use placeholder or extract. */}

                                    <div className="relative h-32 w-full bg-stone-100 rounded-lg overflow-hidden">
                                        {/* Simplified Image logic implies we need a robust Image component. */}
                                        {/* For Timeline, we just show Title + Date + Location mostly. */}
                                        <div className="absolute inset-0 flex items-center justify-center text-stone-300 text-xs">
                                            🏞️ 사진 기록
                                        </div>
                                    </div>

                                    <p className="text-sm text-stone-600 line-clamp-3 leading-relaxed">
                                        {record.content || "기록된 내용이 없습니다."}
                                    </p>
                                </div>
                            </div>
                        </div>
                    ))}

                    {!isLoading && records.length === 0 && (
                        <div className="pl-8 text-stone-400">
                            기록이 없습니다.
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
}
