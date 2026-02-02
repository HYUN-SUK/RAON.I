'use client';

import { ToggleKey, ToggleConfig, CAMPING_TOGGLES, MAX_TOGGLE_SELECTION } from '@/types/camping-ajiit';
import { cn } from '@/lib/utils';
import {
    Check, ShowerHead, Zap, Wifi, Dog, Flame, Baby,
    Waves, Moon, Sunrise, TreePine, ParkingCircle, Umbrella
} from 'lucide-react';
import { toast } from 'sonner';

// 아이콘 매핑
const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
    ShowerHead,
    Zap,
    Wifi,
    Dog,
    Flame,
    Baby,
    Waves,
    Moon,
    Sunrise,
    TreePine,
    ParkingCircle,
    Umbrella,
};

interface ToggleSelectorProps {
    selectedToggles: ToggleKey[];
    onToggle: (toggles: ToggleKey[]) => void;
    className?: string;
}

/**
 * 시설/환경 토글 선택 컴포넌트
 * 12개 토글, 최대 4개 선택 가능
 */
export function ToggleSelector({ selectedToggles, onToggle, className }: ToggleSelectorProps) {
    const handleToggle = (key: ToggleKey) => {
        const isSelected = selectedToggles.includes(key);

        if (isSelected) {
            // 선택 해제
            onToggle(selectedToggles.filter((t) => t !== key));
        } else {
            // 선택 추가 (최대 개수 체크)
            if (selectedToggles.length >= MAX_TOGGLE_SELECTION) {
                toast.info(`최대 ${MAX_TOGGLE_SELECTION}개까지 선택할 수 있어요`);
                return;
            }
            onToggle([...selectedToggles, key]);
        }
    };

    return (
        <div className={cn('space-y-3', className)}>
            <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">
                    어떤 시설이 필요하세요?
                </h3>
                <span className="text-sm text-gray-400">
                    {selectedToggles.length}/{MAX_TOGGLE_SELECTION}
                </span>
            </div>
            <p className="text-sm text-gray-500">
                꼭 필요한 시설을 선택해 주세요 (선택사항)
            </p>

            <div className="grid grid-cols-3 gap-2 mt-4">
                {CAMPING_TOGGLES.map((toggle) => (
                    <ToggleChip
                        key={toggle.key}
                        toggle={toggle}
                        isSelected={selectedToggles.includes(toggle.key)}
                        onToggle={() => handleToggle(toggle.key)}
                        disabled={
                            !selectedToggles.includes(toggle.key) &&
                            selectedToggles.length >= MAX_TOGGLE_SELECTION
                        }
                    />
                ))}
            </div>
        </div>
    );
}

interface ToggleChipProps {
    toggle: ToggleConfig;
    isSelected: boolean;
    onToggle: () => void;
    disabled?: boolean;
}

function ToggleChip({ toggle, isSelected, onToggle, disabled }: ToggleChipProps) {
    const IconComponent = ICON_MAP[toggle.icon];

    return (
        <button
            type="button"
            onClick={onToggle}
            disabled={disabled}
            className={cn(
                'relative flex flex-col items-center justify-center gap-1 py-3 px-2 rounded-xl',
                'border transition-all duration-200',
                'touch-manipulation active:scale-95',
                'text-xs font-medium',
                isSelected
                    ? 'bg-brand-1 border-brand-1 text-white shadow-md'
                    : disabled
                        ? 'bg-gray-50 border-gray-200 text-gray-300 cursor-not-allowed'
                        : 'bg-white border-gray-200 text-gray-700 hover:border-brand-2/50'
            )}
        >
            {/* 아이콘 */}
            <div className={cn(
                'w-8 h-8 rounded-lg flex items-center justify-center',
                isSelected ? 'bg-white/20' : 'bg-gray-100'
            )}>
                {IconComponent && (
                    <IconComponent className={cn(
                        'w-4 h-4',
                        isSelected ? 'text-white' : 'text-gray-600'
                    )} />
                )}
            </div>

            {/* 라벨 */}
            <span className="truncate w-full text-center">{toggle.label}</span>

            {/* 선택 표시 */}
            {isSelected && (
                <div className="absolute top-1 right-1 w-4 h-4 rounded-full bg-white flex items-center justify-center">
                    <Check className="w-3 h-3 text-brand-1" />
                </div>
            )}
        </button>
    );
}

export default ToggleSelector;

