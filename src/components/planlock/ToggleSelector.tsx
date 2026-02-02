'use client';

import { ToggleKey, ToggleConfig, CAMPING_TOGGLES, MAX_TOGGLE_SELECTION } from '@/types/camping-ajiit';
import { cn } from '@/lib/utils';
import { Check } from 'lucide-react';
import { toast } from 'sonner';

interface ToggleSelectorProps {
    selectedToggles: ToggleKey[];
    onToggle: (toggles: ToggleKey[]) => void;
    className?: string;
}

/**
 * 시설/환경 토글 선택 컴포넌트
 * 6개 토글, 최대 3개 선택 가능
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

            <div className="flex flex-wrap gap-2 mt-4">
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
    return (
        <button
            type="button"
            onClick={onToggle}
            disabled={disabled}
            className={cn(
                'inline-flex items-center gap-1.5 px-4 py-2.5 rounded-full',
                'border transition-all duration-200',
                'touch-manipulation active:scale-95',
                'text-sm font-medium',
                isSelected
                    ? 'bg-brand-1 border-brand-1 text-white'
                    : disabled
                        ? 'bg-gray-50 border-gray-200 text-gray-300 cursor-not-allowed'
                        : 'bg-white border-gray-200 text-gray-700 hover:border-brand-2/50'
            )}
        >
            {/* 아이콘 */}
            <span className="text-base" role="img" aria-label={toggle.label}>
                {toggle.icon}
            </span>

            {/* 라벨 */}
            <span>{toggle.label}</span>

            {/* 선택 표시 */}
            {isSelected && <Check className="w-4 h-4 ml-0.5" />}
        </button>
    );
}

export default ToggleSelector;
