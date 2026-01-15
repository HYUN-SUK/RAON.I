import React from 'react';
import { Sun, Cloud, CloudSun, CloudRain, CloudSnow, MoonStar, Moon } from 'lucide-react';
import { WeatherType } from '@/hooks/useWeather';

interface WeatherIconProps {
    type: WeatherType;
    className?: string;
    isDay?: boolean; // Default to true if not provided
}

export const WeatherIcon = ({ type, className = "w-6 h-6", isDay = true }: WeatherIconProps) => {

    switch (type) {
        case 'sunny':
            return isDay
                ? <Sun className={`${className} text-orange-500 fill-orange-100/50`} />
                : <Moon className={`${className} text-stone-300 fill-stone-100/30`} />;

        case 'partly_cloudy':
            // 낮: 구름(회색) + 해(주황색) 조합, 밤: 구름(회색) + 달(흰색)
            return isDay ? (
                <div className={`relative ${className}`}>
                    <Cloud className="absolute w-full h-full text-stone-400" />
                    <Sun className="absolute w-[55%] h-[55%] -top-[10%] -right-[10%] text-orange-500" />
                </div>
            ) : (
                <div className={`relative ${className}`}>
                    <Cloud className="absolute w-full h-full text-stone-400" />
                    <Moon className="absolute w-[50%] h-[50%] -top-[5%] -right-[5%] text-stone-300" />
                </div>
            );

        case 'cloudy':
            return <Cloud className={`${className} text-stone-500 fill-stone-100`} />;

        case 'rainy':
            return <CloudRain className={`${className} text-blue-500 fill-blue-50`} />;

        case 'snowy':
            return <CloudSnow className={`${className} text-sky-400 fill-sky-50`} />;

        default:
            // 기본값도 낮/밤 구분
            return isDay
                ? <Sun className={`${className} text-stone-400`} />
                : <Moon className={`${className} text-stone-300`} />;
    }
};
