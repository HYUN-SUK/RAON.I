'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Tent, MapPin, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface SmartPlanModeSelectorProps {
    onSelect: (travelType: 'camping' | 'general') => void;
}

export default function SmartPlanModeSelector({ onSelect }: SmartPlanModeSelectorProps) {
    const [selected, setSelected] = useState<'camping' | 'general' | null>(null);

    const modes = [
        {
            key: 'camping' as const,
            icon: <Tent className="w-8 h-8" />,
            emoji: '🏕️',
            title: '캠핑 체류형',
            desc: '사이트에서 여유롭게 쉬며,\n필요한 장소만 쏙쏙 확인',
            tags: ['텐트 피칭', '바비큐', '불멍', '인근 마트'],
        },
        {
            key: 'general' as const,
            icon: <MapPin className="w-8 h-8" />,
            emoji: '🗺️',
            title: '일반 관광형',
            desc: '시간 흐름에 맞춰\n동선 기반 맛집·명소·카페 코스',
            tags: ['아침→점심→저녁', '동선 최적화', '시간표'],
        },
    ];

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
            className="flex flex-col gap-4 p-1"
        >
            {/* Header */}
            <div className="text-center mb-1">
                <p className="text-xs font-bold text-[#224732]/60 tracking-wider uppercase">Smart Plan LIVE</p>
                <h3 className="text-lg font-black text-gray-900 mt-1">여행 스타일을 선택하세요</h3>
                <p className="text-xs text-gray-400 mt-1">선택에 따라 AI가 맞춤 타임라인을 생성합니다</p>
            </div>

            {/* Mode Cards */}
            <div className="flex flex-col gap-3">
                {modes.map((mode) => {
                    const isSelected = selected === mode.key;
                    return (
                        <motion.button
                            key={mode.key}
                            whileTap={{ scale: 0.97 }}
                            onClick={() => setSelected(mode.key)}
                            className={`relative w-full text-left p-5 rounded-2xl border-2 transition-all duration-200 ${
                                isSelected
                                    ? 'border-[#224732] bg-[#224732]/5 shadow-lg shadow-[#224732]/10'
                                    : 'border-gray-100 bg-white hover:border-gray-200 hover:shadow-sm'
                            }`}
                        >
                            {/* Selected Check */}
                            {isSelected && (
                                <motion.div
                                    initial={{ scale: 0 }}
                                    animate={{ scale: 1 }}
                                    className="absolute top-3 right-3 w-6 h-6 rounded-full bg-[#224732] flex items-center justify-center"
                                >
                                    <Check className="w-3.5 h-3.5 text-white" strokeWidth={3} />
                                </motion.div>
                            )}

                            <div className="flex items-start gap-4">
                                {/* Icon */}
                                <div className={`flex-shrink-0 w-14 h-14 rounded-xl flex items-center justify-center text-2xl ${
                                    isSelected ? 'bg-[#224732]/10' : 'bg-gray-50'
                                }`}>
                                    {mode.emoji}
                                </div>

                                {/* Content */}
                                <div className="flex-1 min-w-0">
                                    <h4 className={`text-base font-black ${isSelected ? 'text-[#224732]' : 'text-gray-900'}`}>
                                        {mode.title}
                                    </h4>
                                    <p className="text-xs text-gray-500 mt-1 whitespace-pre-line leading-relaxed">
                                        {mode.desc}
                                    </p>
                                    {/* Tags */}
                                    <div className="flex flex-wrap gap-1.5 mt-2.5">
                                        {mode.tags.map((tag) => (
                                            <span
                                                key={tag}
                                                className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                                    isSelected
                                                        ? 'bg-[#224732]/10 text-[#224732]'
                                                        : 'bg-gray-100 text-gray-500'
                                                }`}
                                            >
                                                {tag}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </motion.button>
                    );
                })}
            </div>

            {/* Confirm Button */}
            <Button
                disabled={!selected}
                onClick={() => selected && onSelect(selected)}
                className={`w-full h-14 rounded-2xl text-base font-black transition-all ${
                    selected
                        ? 'bg-[#224732] hover:bg-[#1a3626] text-white shadow-lg shadow-[#224732]/25 active:scale-[0.98]'
                        : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                }`}
            >
                {selected ? '이 스타일로 타임라인 생성' : '스타일을 선택해 주세요'}
            </Button>
        </motion.div>
    );
}
