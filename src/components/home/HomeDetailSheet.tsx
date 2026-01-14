import React, { useState, useEffect, useCallback } from 'react';
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { ArrowRight, Clock, Flame, Users, ChevronDown, Check, Dices } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";

export interface HomeDetailData {
    // ... items
    title: string;
    description: string;
    icon: React.ReactNode;
    categoryLabel?: string;
    actionLabel?: string;
    actionLink?: string;
    bgColorClass?: string;
    image_url?: string;
    buttons?: {
        label: string;
        onClick: () => void;
        variant?: 'default' | 'outline' | 'secondary' | 'ghost' | 'destructive';
        icon?: React.ReactNode;
    }[];
    // V2 Rich Data
    ingredients?: string[] | { name: string; amount: string }[];
    steps?: string[];
    tips?: string;
    time_required?: number;
    difficulty?: number;
    // V2.1 Premium Data
    servings?: string;
    calories?: number;
    age_group?: string;
    location_type?: string;
    // V9 Personalization
    reason?: string;
    category?: 'cooking' | 'play';
}

interface HomeDetailSheetProps {
    isOpen: boolean;
    onClose: () => void;
    data: HomeDetailData | null;
    onShuffle?: (category: 'cooking' | 'play') => void;
}

export default function HomeDetailSheet({ isOpen, onClose, data, onShuffle }: HomeDetailSheetProps) {
    const router = useRouter();
    const [checkedIngredients, setCheckedIngredients] = useState<number[]>([]);

    // 백버튼 처리: Sheet 열릴 때 히스토리 추가, 백버튼 시 Sheet 닫기
    useEffect(() => {
        if (isOpen) {
            // 히스토리에 상태 추가 (백버튼 누르면 이 상태로 돌아옴)
            history.pushState({ sheet: 'detail' }, '');

            const handlePopState = () => {
                // 백버튼 감지 시 Sheet 닫기
                onClose();
            };

            window.addEventListener('popstate', handlePopState);

            return () => {
                window.removeEventListener('popstate', handlePopState);
            };
        }
    }, [isOpen, onClose]);

    // 데이터 없으면 렌더링 안함 (훅 호출 후에 조건부 return)
    if (!data) return null;

    const handleShuffle = () => {
        if (onShuffle && data.category) {
            onShuffle(data.category);
            toast.success("새로운 추천을 가져왔습니다! 🎲");
            onClose();
        }
    };

    const toggleIngredient = (index: number) => {
        setCheckedIngredients(prev =>
            prev.includes(index)
                ? prev.filter(i => i !== index)
                : [...prev, index]
        );
    };


    return (
        <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <SheetContent side="bottom" className="rounded-t-[32px] p-0 border-none max-h-[92vh] overflow-y-auto outline-none bg-white dark:bg-zinc-900">
                {/* 1. Header Actions (Close) */}
                <div className="sticky top-0 z-50 flex justify-end p-4 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md rounded-t-[32px]">
                    <button
                        onClick={onClose}
                        className="w-8 h-8 rounded-full bg-stone-100 hover:bg-stone-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 flex items-center justify-center transition-colors"
                    >
                        <ChevronDown size={20} className="text-stone-600 dark:text-stone-400" />
                    </button>
                </div>

                {/* 2. Content Card */}
                <div className="px-6 pb-8">
                    <div className="bg-white dark:bg-zinc-900 rounded-3xl shadow-sm p-1 pt-6">
                        <SheetHeader className="text-left space-y-2 mb-6">
                            <div className="flex flex-col gap-2">
                                {/* Reason Badge */}
                                {data.reason && (
                                    <div className="inline-flex self-start">
                                        <Badge variant="secondary" className="bg-[#1C4526]/10 text-[#1C4526] hover:bg-[#1C4526]/20 border-none px-2 py-0.5 text-[10px] font-bold">
                                            ✨ {data.reason}
                                        </Badge>
                                    </div>
                                )}
                                <div className="flex items-start justify-between">
                                    <SheetTitle className="text-2xl font-bold text-stone-900 dark:text-stone-100 leading-tight">
                                        {data.title}
                                    </SheetTitle>
                                    {data.categoryLabel && (
                                        <Badge variant="outline" className="text-[10px] text-stone-500 border-stone-200 shrink-0 ml-2">
                                            {data.categoryLabel}
                                        </Badge>
                                    )}
                                </div>
                            </div>
                            <SheetDescription className="text-base text-stone-600 dark:text-stone-400 break-keep whitespace-pre-line">
                                {data.description}
                            </SheetDescription>
                        </SheetHeader>

                        {/* 3. Info Bar (Metadata) - Only show if data exists */}
                        {(data.time_required || data.difficulty || data.servings || data.age_group) && (
                            <div className="flex items-center justify-between bg-stone-50 dark:bg-zinc-800/50 rounded-2xl p-4 mb-8 border border-stone-100 dark:border-zinc-800">
                                {/* Time */}
                                <div className="flex flex-col items-center flex-1 border-r border-stone-200 dark:border-zinc-700 last:border-0">
                                    <Clock className="w-5 h-5 text-stone-400 mb-1" />
                                    <span className="text-xs font-bold text-stone-700 dark:text-stone-300">{data.time_required ? `${data.time_required}분` : '-'}</span>
                                    <span className="text-[10px] text-stone-400">소요시간</span>
                                </div>
                                {/* Difficulty */}
                                <div className="flex flex-col items-center flex-1 border-r border-stone-200 dark:border-zinc-700 last:border-0">
                                    <Flame className="w-5 h-5 text-stone-400 mb-1" />
                                    <span className="text-xs font-bold text-stone-700 dark:text-stone-300">{data.difficulty ? '⭐'.repeat(data.difficulty) : '-'}</span>
                                    <span className="text-[10px] text-stone-400">난이도</span>
                                </div>
                                {/* Servings OR Age */}
                                <div className="flex flex-col items-center flex-1 last:border-0">
                                    <Users className="w-5 h-5 text-stone-400 mb-1" />
                                    <span className="text-xs font-bold text-stone-700 dark:text-stone-300">
                                        {data.servings || data.age_group || '-'}
                                    </span>
                                    <span className="text-[10px] text-stone-400">{data.servings ? '인분' : '권장연령'}</span>
                                </div>
                            </div>
                        )}

                        {/* 4. Calories / Location Badge (Optional) */}
                        <div className="flex flex-wrap gap-2 mb-8">
                            {data.calories && (
                                <Badge variant="secondary" className="bg-orange-50 text-orange-700 border-orange-100 py-1 px-3">
                                    🔥 {data.calories} kcal
                                </Badge>
                            )}
                            {data.location_type && (
                                <Badge variant="secondary" className="bg-green-50 text-green-700 border-green-100 py-1 px-3">
                                    📍 {data.location_type}
                                </Badge>
                            )}
                        </div>

                        {/* 5. Ingredients (Checklist) */}
                        {data.ingredients && (
                            <div className="mb-8">
                                <h3 className="text-lg font-bold text-stone-900 dark:text-stone-100 mb-4 flex items-center">
                                    준비물 <span className="text-stone-400 text-sm font-normal ml-2">({data.ingredients.length}개)</span>
                                </h3>
                                <div className="grid grid-cols-1 gap-3">
                                    {Array.isArray(data.ingredients) && data.ingredients.map((ing, i) => {
                                        const isChecked = checkedIngredients.includes(i);
                                        const name = typeof ing === 'string' ? ing : ing.name;
                                        const amount = typeof ing === 'string' ? '' : ing.amount;

                                        return (
                                            <div
                                                key={i}
                                                className={`
                                                    flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer
                                                    ${isChecked
                                                        ? 'bg-stone-50 border-stone-200 text-stone-400'
                                                        : 'bg-white border-stone-200 hover:border-[#1C4526] text-stone-800 shadow-sm'
                                                    }
                                                `}
                                                onClick={() => toggleIngredient(i)}
                                            >
                                                <div className="flex items-center gap-3">
                                                    <div className={`
                                                        w-5 h-5 rounded-full border flex items-center justify-center transition-colors
                                                        ${isChecked ? 'bg-stone-300 border-stone-300' : 'border-stone-300'}
                                                    `}>
                                                        {isChecked && <Check size={12} className="text-white" />}
                                                    </div>
                                                    <span className={isChecked ? 'line-through' : 'font-medium'}>{name}</span>
                                                </div>
                                                {amount && <span className={`text-sm ${isChecked ? 'text-stone-300' : 'text-[#1C4526] font-bold'}`}>{amount}</span>}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {/* 6. Steps (Timeline) */}
                        {data.steps && (
                            <div className="mb-8">
                                <h3 className="text-lg font-bold text-stone-900 dark:text-stone-100 mb-6">진행 방법</h3>
                                <div className="space-y-0 relative">
                                    {/* Vertical Line */}
                                    <div className="absolute left-[15px] top-4 bottom-4 w-0.5 bg-stone-100 dark:bg-zinc-800" />

                                    {data.steps.map((step, i) => (
                                        <div key={i} className="relative flex gap-4 pb-8 last:pb-0">
                                            {/* Number Bubble */}
                                            <div className="flex-none w-8 h-8 rounded-full bg-[#1C4526] text-white text-sm font-bold flex items-center justify-center relative z-10 ring-4 ring-white dark:ring-zinc-900">
                                                {i + 1}
                                            </div>
                                            <div className="pt-1">
                                                <p className="text-15px text-stone-700 dark:text-stone-300 leading-relaxed font-medium">
                                                    {step}
                                                </p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* 7. Tips */}
                        {data.tips && (
                            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-900/30 rounded-2xl p-5 mb-8">
                                <div className="flex items-start gap-3">
                                    <span className="text-xl">💡</span>
                                    <div>
                                        <h4 className="font-bold text-amber-900 dark:text-amber-100 text-sm mb-1">Honey Tip</h4>
                                        <p className="text-sm text-amber-800 dark:text-amber-200/80 leading-relaxed">
                                            {data.tips}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Shuffle Button Section */}
                        {onShuffle && data.category && (
                            <div className="mb-6">
                                <Button
                                    variant="outline"
                                    className="w-full h-12 border-dashed border-stone-300 text-stone-500 hover:text-stone-800 hover:bg-stone-50 hover:border-stone-400 rounded-2xl gap-2"
                                    onClick={handleShuffle}
                                >
                                    <Dices size={18} />
                                    다른 추천 뽑기
                                </Button>
                            </div>
                        )}

                        {/* 8. Bottom Actions */}
                        <div className="space-y-3 pt-4 border-t border-stone-100 dark:border-zinc-800">
                            {/* Primary Action Button */}
                            {data.actionLabel && !data.buttons && (
                                <Button
                                    className="w-full h-14 text-lg rounded-2xl bg-[#1C4526] hover:bg-[#14331C] text-white shadow-lg shadow-[#1C4526]/20"
                                    onClick={() => {
                                        if (data.actionLink) {
                                            if (data.actionLink.startsWith('http') || data.actionLink.startsWith('tel:') || data.actionLink.startsWith('sms:')) {
                                                window.location.href = data.actionLink;
                                            } else {
                                                router.push(data.actionLink);
                                            }
                                            onClose();
                                        }
                                    }}
                                >
                                    {data.actionLabel}
                                    <ArrowRight className="w-5 h-5 ml-2" />
                                </Button>
                            )}

                            {/* Multiple Buttons */}
                            {data.buttons?.map((btn, idx) => (
                                <Button
                                    key={idx}
                                    variant={btn.variant || 'default'}
                                    className={`w-full h-14 text-lg rounded-2xl ${(!btn.variant || btn.variant === 'default')
                                        ? 'bg-[#1C4526] text-white'
                                        : 'bg-white border border-stone-200 text-stone-700 hover:bg-stone-50'
                                        }`}
                                    onClick={() => {
                                        btn.onClick();
                                        onClose();
                                    }}
                                >
                                    {btn.icon && <span className="mr-2">{btn.icon}</span>}
                                    {btn.label}
                                </Button>
                            ))}

                            {/* Return Button */}
                            <Button
                                variant="ghost"
                                className="w-full h-12 text-stone-500 hover:text-stone-900 hover:bg-stone-100 rounded-2xl"
                                onClick={onClose}
                            >
                                목록으로 돌아가기
                            </Button>
                        </div>
                    </div>
                </div>
            </SheetContent>
        </Sheet>
    );
}
