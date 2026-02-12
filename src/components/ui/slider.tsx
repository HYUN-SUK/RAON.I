import React from 'react';
import { cn } from '@/lib/utils';

interface SliderProps {
    defaultValue?: number[];
    value?: number[];
    min?: number;
    max?: number;
    step?: number;
    onValueChange?: (value: number[]) => void;
    className?: string;
    disabled?: boolean;
}

export const Slider = React.forwardRef<HTMLInputElement, SliderProps>(
    ({ className, min = 0, max = 100, step = 1, value, defaultValue, onValueChange, disabled, ...props }, ref) => {
        const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
            const val = parseFloat(e.target.value);
            if (onValueChange) {
                onValueChange([val]);
            }
        };

        const currentValue = value ? value[0] : defaultValue ? defaultValue[0] : min;

        return (
            <input
                type="range"
                min={min}
                max={max}
                step={step}
                value={currentValue}
                onChange={handleChange}
                disabled={disabled}
                ref={ref}
                className={cn(
                    "w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-primary",
                    disabled && "opacity-50 cursor-not-allowed",
                    className
                )}
                {...props}
            />
        );
    }
);

Slider.displayName = "Slider";
