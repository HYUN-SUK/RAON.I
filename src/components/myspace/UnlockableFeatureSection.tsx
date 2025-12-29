"use client";

import React from 'react';
import { Lock, Palette, Map, Calendar, Clock, Image as ImageIcon, Sparkles, Moon, CloudFog, Camera, Sticker, ChevronDown } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface OptionItem {
    name: string;
    icon: React.ElementType; // Lucide Icon Component
    color: string;
    cost: number;
}

const VIEW_OPTIONS: OptionItem[] = [
    { name: '계절별 모아보기', icon: Palette, color: 'text-orange-500', cost: 10 },
    { name: '책으로 보기', icon: Map, color: 'text-emerald-600', cost: 20 },
    { name: '감정 캘린더', icon: Calendar, color: 'text-rose-500', cost: 15 },
    { name: '타임라인', icon: Clock, color: 'text-blue-500', cost: 10 },
    { name: '사진 갤러리', icon: ImageIcon, color: 'text-purple-500', cost: 10 },
];

const EDIT_OPTIONS: OptionItem[] = [
    { name: '빈티지 필터', icon: Sparkles, color: 'text-amber-600', cost: 5 },
    { name: '폴라로이드', icon: Camera, color: 'text-stone-600', cost: 5 },
    { name: '숲속의 밤', icon: Moon, color: 'text-indigo-400', cost: 30 },
    { name: '새벽 안개', icon: CloudFog, color: 'text-slate-400', cost: 30 },
    { name: '로그 스티커', icon: Sticker, color: 'text-pink-500', cost: 5 },
];

export default function UnlockableFeatureSection() {
    const [isOpen, setIsOpen] = React.useState(false);

    const handlelockedFeatureClick = (featureName: string, cost: number) => {
        toast('준비 중인 기능입니다', {
            description: `'${featureName}' 기능을 사용하려면 ${cost} 토큰이 필요합니다. 곧 업데이트 될 예정이에요!`
        });
    };

    const renderOptionList = (title: string, options: OptionItem[]) => (
        <div className="mb-10 last:mb-0">
            <h4 className="text-[10px] font-bold text-[#1C4526]/70 uppercase tracking-widest mb-4 px-1 flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-[#1C4526] rounded-full inline-block"></span>
                {title}
            </h4>
            <div className="flex gap-4 overflow-x-auto pb-6 -mx-6 px-6 scrollbar-hide snap-x">
                {options.map((opt) => (
                    <button
                        key={opt.name}
                        onClick={() => handlelockedFeatureClick(opt.name, opt.cost)}
                        className="flex flex-col items-center gap-2.5 min-w-[76px] group snap-start relative"
                    >
                        <div className="relative transition-transform duration-300 group-hover:-translate-y-1">
                            {/* Icon Container */}
                            <div className="w-16 h-16 rounded-3xl bg-white dark:bg-zinc-900 border border-[#ECE8DF] dark:border-zinc-700 shadow-[0_2px_8px_-2px_rgba(0,0,0,0.05)] group-hover:shadow-[0_4px_12px_-2px_rgba(28,69,38,0.1)] flex items-center justify-center relative overflow-hidden transition-all duration-300">
                                <div className="absolute inset-0 bg-gradient-to-br from-[#F5F2EB]/50 to-transparent dark:from-zinc-800/50 opacity-100 group-hover:opacity-0 transition-opacity" />
                                <opt.icon
                                    size={24}
                                    className={cn("transition-all duration-300 group-hover:scale-110", opt.color)}
                                    strokeWidth={1.5}
                                />
                                {/* Cost Badge (Inside) */}
                                <div className="absolute bottom-0 inset-x-0 h-5 bg-[#F7F5EF] dark:bg-zinc-800 flex items-center justify-center border-t border-[#ECE8DF] dark:border-zinc-700">
                                    <span className="text-[9px] font-bold text-stone-500 dark:text-stone-400">{opt.cost} T</span>
                                </div>
                            </div>

                            {/* Lock Badge (Floating) */}
                            <div className="absolute -top-1 -right-1 bg-[#1C4526] text-white p-1 rounded-full shadow-lg border-[1.5px] border-white dark:border-black z-10">
                                <Lock className="w-2 h-2" strokeWidth={2.5} />
                            </div>
                        </div>

                        <span className="text-[11px] font-semibold text-stone-600 dark:text-stone-300 text-center leading-tight break-keep px-1 group-hover:text-[#1C4526] dark:group-hover:text-green-400 transition-colors">
                            {opt.name}
                        </span>
                    </button>
                ))}
            </div>
        </div>
    );

    return (
        <div className="mt-8 border-t border-dashed border-[#ECE8DF] dark:border-zinc-800 pt-6">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-full flex items-center justify-center gap-2 py-2 text-stone-500 hover:text-[#1C4526] dark:text-stone-400 dark:hover:text-green-400 transition-colors"
            >
                <div className="flex items-center gap-2 bg-white dark:bg-zinc-900 px-4 py-2 rounded-full border border-[#ECE8DF] dark:border-zinc-700 shadow-sm">
                    <span className="text-xs font-bold">보기, 편집 도구</span>
                    <ChevronDown className={cn("w-4 h-4 transition-transform duration-300", isOpen && "rotate-180")} />
                </div>
            </button>

            <div className={cn(
                "grid transition-all duration-500 ease-in-out overflow-hidden",
                isOpen ? "grid-rows-[1fr] opacity-100 mt-6" : "grid-rows-[0fr] opacity-0 mt-0"
            )}>
                <div className="min-h-0">
                    {renderOptionList('VIEW OPTIONS', VIEW_OPTIONS)}
                    {renderOptionList('EDIT TOOLS', EDIT_OPTIONS)}
                </div>
            </div>
        </div>
    );
}
