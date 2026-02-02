'use client';

import { CampingMode, CampingModeConfig, CAMPING_MODES } from '@/types/camping-ajiit';
import { cn } from '@/lib/utils';
import { Check, Users, User, Heart, Flame, Car, Leaf } from 'lucide-react';

// 아이콘 매핑
const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
    Users,
    User,
    Heart,
    Flame,
    Car,
    Leaf,
};

interface ModeSelectorProps {
    selectedMode: CampingMode | null;
    onSelect: (mode: CampingMode) => void;
    className?: string;
}

/**
 * 캠핑 모드 선택 컴포넌트
 * 6개 모드: 가족, 솔로, 커플, 친구, 차박, 힐링
 */
export function ModeSelector({ selectedMode, onSelect, className }: ModeSelectorProps) {
    return (
        <div className={cn('space-y-3', className)}>
            <h3 className="text-lg font-semibold text-gray-900">
                어떤 캠핑을 계획하고 계세요?
            </h3>
            <p className="text-sm text-gray-500">
                모드를 선택하면 맞춤 캠핑장을 추천해 드려요
            </p>

            <div className="grid grid-cols-3 gap-3 mt-4">
                {CAMPING_MODES.map((mode) => (
                    <ModeCard
                        key={mode.key}
                        mode={mode}
                        isSelected={selectedMode === mode.key}
                        onSelect={() => onSelect(mode.key)}
                    />
                ))}
            </div>
        </div>
    );
}

interface ModeCardProps {
    mode: CampingModeConfig;
    isSelected: boolean;
    onSelect: () => void;
}

function ModeCard({ mode, isSelected, onSelect }: ModeCardProps) {
    const IconComponent = ICON_MAP[mode.icon];

    return (
        <button
            type="button"
            onClick={onSelect}
            className={cn(
                'relative flex flex-col items-center justify-center',
                'p-4 rounded-2xl border-2 transition-all duration-200',
                'touch-manipulation active:scale-95',
                'min-h-[100px]',
                isSelected
                    ? 'border-brand-1 bg-brand-1/5 shadow-md'
                    : 'border-gray-200 bg-white hover:border-brand-2/50 hover:bg-gray-50'
            )}
        >
            {/* 선택 표시 */}
            {isSelected && (
                <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-brand-1 flex items-center justify-center">
                    <Check className="w-3 h-3 text-white" />
                </div>
            )}

            {/* 아이콘 */}
            <div className={cn(
                'w-10 h-10 rounded-xl flex items-center justify-center mb-2',
                isSelected ? 'bg-brand-1/10' : 'bg-gray-100'
            )}>
                {IconComponent && (
                    <IconComponent className={cn(
                        'w-5 h-5',
                        isSelected ? 'text-brand-1' : 'text-gray-600'
                    )} />
                )}
            </div>

            {/* 라벨 */}
            <span className={cn(
                'text-sm font-medium',
                isSelected ? 'text-brand-1' : 'text-gray-700'
            )}>
                {mode.label}
            </span>
        </button>
    );
}

export default ModeSelector;

