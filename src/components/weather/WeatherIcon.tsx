import React from 'react';
import { Sun, Cloud, CloudSun, CloudRain, CloudSnow, MoonStar, CloudLightning, CloudDrizzle } from 'lucide-react';
import { WeatherType } from '@/hooks/useWeather';

interface WeatherIconProps {
    type: WeatherType;
    className?: string;
    isDay?: boolean; // Default to true if not provided
}

export const WeatherIcon = ({ type, className = "w-6 h-6", isDay = true }: WeatherIconProps) => {

    // Size helper (extract w/h from className if needed, or just apply className)
    // Lucide accepts className directly.

    switch (type) {
        case 'sunny':
            return isDay
                ? <Sun className={`${className} text-orange-500 fill-orange-100/50`} />
                : <MoonStar className={`${className} text-yellow-400 fill-yellow-100/20`} />;

        case 'partly_cloudy':
            return <CloudSun className={`${className} text-stone-500`} />; // Lucide doesn't distinct Sun color inside CloudSun easily via class.
        // But we can assume it's nice enough.

        case 'cloudy':
            return <Cloud className={`${className} text-stone-500 fill-stone-100`} />;

        case 'rainy':
            return <CloudRain className={`${className} text-blue-500 fill-blue-50`} />;

        case 'snowy':
            return <CloudSnow className={`${className} text-sky-400 fill-sky-50`} />;

        default:
            return <Sun className={`${className} text-stone-400`} />;
    }
};
