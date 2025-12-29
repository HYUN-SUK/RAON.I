import React from 'react';
import { UsePointResult } from '@/hooks/usePoint';
import { Star, Zap, Trophy, Crown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PointStatusCardProps {
    wallet: UsePointResult['wallet'];
    loading: boolean;
    variant?: 'summary' | 'detail'; // Default is 'summary'
}

export function PointStatusCard({ wallet, loading, variant = 'summary' }: PointStatusCardProps) {
    if (loading) {
        return (
            <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 shadow-sm border border-[#ECE8DF] dark:border-zinc-800 animate-pulse">
                <div className="h-4 w-24 bg-stone-200 dark:bg-zinc-800 rounded mb-4" />
                <div className="flex gap-4">
                    <div className="h-12 w-12 bg-stone-200 dark:bg-zinc-800 rounded-full" />
                    <div className="flex-1 space-y-2">
                        <div className="h-4 w-full bg-stone-200 dark:bg-zinc-800 rounded" />
                        <div className="h-4 w-2/3 bg-stone-200 dark:bg-zinc-800 rounded" />
                    </div>
                </div>
            </div>
        );
    }

    const currentLevel = wallet?.level || 1;
    const currentXp = wallet?.xp || 0;
    const currentToken = wallet?.raonToken || 0;

    // XP Calculation
    const nextLevelXp = Math.pow(currentLevel, 2) * 100;
    const prevLevelXp = Math.pow(currentLevel - 1, 2) * 100;
    const progress = Math.min(100, Math.max(0, ((currentXp - prevLevelXp) / (nextLevelXp - prevLevelXp)) * 100));

    // Detail View: Balanced Layout (Level | XP | Token) - No Title
    if (variant === 'detail') {
        return (
            <div className="bg-white dark:bg-zinc-900 rounded-3xl p-6 shadow-soft border border-[#ECE8DF] dark:border-zinc-800">
                <div className="flex items-center justify-between text-center divide-x divide-stone-100 dark:divide-zinc-800">
                    {/* Level */}
                    <div className="flex-1 px-2">
                        <p className="text-xs font-bold text-stone-400 mb-1 tracking-wider uppercase">Level</p>
                        <div className="flex items-center justify-center gap-1">
                            <Crown className="w-5 h-5 text-amber-500 fill-amber-500" />
                            <span className="text-2xl font-black text-[#1C4526] dark:text-green-400">{currentLevel}</span>
                        </div>
                    </div>

                    {/* XP */}
                    <div className="flex-1 px-2">
                        <p className="text-xs font-bold text-stone-400 mb-1 tracking-wider uppercase">Experience</p>
                        <div className="flex items-center justify-center gap-1">
                            <Star className="w-4 h-4 text-emerald-500" />
                            <span className="text-lg font-bold text-stone-700 dark:text-stone-200">{currentXp.toLocaleString()}</span>
                            <span className="text-xs font-medium text-stone-400">xp</span>
                        </div>
                    </div>

                    {/* Token */}
                    <div className="flex-1 px-2">
                        <p className="text-xs font-bold text-stone-400 mb-1 tracking-wider uppercase">Raon Token</p>
                        <div className="flex items-center justify-center gap-1">
                            <Zap className="w-4 h-4 text-orange-400 fill-orange-400" />
                            <span className="text-lg font-bold text-stone-700 dark:text-stone-200">{currentToken.toLocaleString()}</span>
                            <span className="text-xs font-medium text-stone-400">개</span>
                        </div>
                    </div>
                </div>

                {/* Gauge for Detail View (Optional, adds nice touch below) */}
                <div className="mt-5 pt-4 border-t border-stone-100 dark:border-zinc-800">
                    <div className="flex justify-between text-xs text-stone-400 mb-1.5">
                        <span>Lv.{currentLevel}</span>
                        <span>{(nextLevelXp - currentXp).toLocaleString()} XP to Next</span>
                    </div>
                    <div className="h-2.5 w-full bg-[#F5F2EB] dark:bg-zinc-800 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-gradient-to-r from-[#1C4526] to-[#3C6E47] rounded-full transition-all duration-1000 ease-out"
                            style={{ width: `${progress}%` }}
                        />
                    </div>
                </div>
            </div>
        );
    }

    // Summary View: Focused on XP/Level, Token as Badge
    return (
        <div className="bg-white dark:bg-zinc-900 rounded-2xl p-5 shadow-sm border border-[#ECE8DF] dark:border-zinc-800 relative overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-[#1C4526] dark:text-green-400 flex items-center gap-1.5">
                    <Star className="w-4 h-4 fill-[#1C4526] dark:fill-green-400" />
                    나의 탐험 지수
                </h3>
                {/* Token Badge */}
                <div className="flex items-center gap-1 text-xs font-bold text-[#1C4526] dark:text-green-400 bg-[#E8F5E9] dark:bg-[#1C4526]/30 px-2.5 py-1 rounded-full">
                    <Zap className="w-3 h-3 fill-current" />
                    {currentToken.toLocaleString()}
                </div>
            </div>

            {/* Level & Gauge */}
            <div className="flex items-end justify-between mb-2">
                <span className="text-3xl font-black text-[#2C2C2C] dark:text-white">Lv.{currentLevel}</span>
                <span className="text-xs text-stone-400 font-medium mb-1.5">
                    {currentXp.toLocaleString()} / {nextLevelXp.toLocaleString()} XP
                </span>
            </div>

            <div className="h-2 w-full bg-[#F5F2EB] dark:bg-zinc-800 rounded-full overflow-hidden">
                <div
                    className="h-full bg-gradient-to-r from-[#1C4526] to-[#3C6E47] rounded-full transition-all duration-1000 ease-out"
                    style={{ width: `${progress}%` }}
                />
            </div>
        </div>
    );
}
