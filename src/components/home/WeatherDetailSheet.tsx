import React from 'react';
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetDescription,
} from "@/components/ui/sheet";
import {
    Cloud, Sun, CloudRain, CloudSnow, Wind, Droplets, Umbrella, CalendarDays, Clock, ArrowRight, ArrowUp
} from 'lucide-react';
import { WeatherIcon } from '@/components/weather/WeatherIcon';
import { WeatherType, DailyForecast, WeatherState } from '@/hooks/useWeather';
import { format, addDays } from 'date-fns';
import { ko } from 'date-fns/locale';

interface WeatherDetailSheetProps {
    isOpen: boolean;
    onClose: () => void;
    weather: WeatherState;
    locationName?: string;
}

export default function WeatherDetailSheet({ isOpen, onClose, weather, locationName = "라온아이 오토캠핑장" }: WeatherDetailSheetProps) {

    // Icon Mapping
    const getWeatherIcon = (type: WeatherType, className = "w-6 h-6") => {
        switch (type) {
            case 'sunny': return <Sun className={`${className} text-orange-500`} />;
            case 'cloudy': return <Cloud className={`${className} text-stone-500`} />;
            case 'partly_cloudy': return <Cloud className={`${className} text-stone-400`} />; // Sun+Cloud icon ideal
            case 'rainy': return <CloudRain className={`${className} text-blue-500`} />;
            case 'snowy': return <CloudSnow className={`${className} text-sky-300`} />;
            default: return <Sun className={`${className} text-stone-400`} />;
        }
    };

    const getWeatherLabel = (type: WeatherType) => {
        switch (type) {
            case 'sunny': return '맑음';
            case 'cloudy': return '흐림';
            case 'partly_cloudy': return '구름 많음';
            case 'rainy': return '비';
            case 'snowy': return '눈';
            default: return '알 수 없음';
        }
    };

    const getWindDirection = (deg: number) => {
        const directions = ['북풍', '북동풍', '동풍', '남동풍', '남풍', '남서풍', '서풍', '북서풍'];
        const index = Math.round(deg / 45) % 8;
        return directions[index];
    };

    return (
        <Sheet open={isOpen} onOpenChange={onClose}>
            <SheetContent side="bottom" className="rounded-t-[30px] p-0 overflow-hidden h-[85vh]">
                <div className="p-6 pb-24 bg-white dark:bg-zinc-900 h-full overflow-y-auto">

                    {/* Header */}
                    <div className="text-center mb-8">
                        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-stone-100 dark:bg-zinc-800 text-stone-500 dark:text-stone-400 text-xs font-medium mb-4">
                            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                            {locationName} 실시간
                        </div>

                        <div className="flex flex-col items-center py-4">
                            <div className="flex items-center gap-6">
                                <WeatherIcon type={weather.type} className="w-20 h-20" />
                                <div className="flex flex-col items-start translate-y-1">
                                    <div className="flex items-baseline gap-2">
                                        <h2 className="text-6xl font-bold tracking-tighter text-stone-900 dark:text-stone-50">
                                            {weather.temp !== null ? Math.round(weather.temp) : '--'}°
                                        </h2>
                                        <span className="text-xl font-medium text-stone-600 dark:text-stone-400">
                                            {getWeatherLabel(weather.type)}
                                        </span>
                                    </div>

                                    {/* Metrics Row (Text based) */}
                                    <div className="flex items-center gap-3 text-sm text-stone-500 dark:text-stone-400 mt-2">
                                        <span className="flex items-center gap-1">
                                            <span>체감</span>
                                            <span className="font-semibold text-stone-700 dark:text-stone-200">
                                                {weather.feelsLike !== null ? Math.round(weather.feelsLike) : '--'}°
                                            </span>
                                        </span>
                                        <span className="w-px h-3 bg-stone-300 dark:bg-zinc-700" />
                                        <span className="flex items-center gap-1">
                                            <span>습도</span>
                                            <span className="font-semibold text-stone-700 dark:text-stone-200">
                                                {weather.humidity}%
                                            </span>
                                        </span>
                                        <span className="w-px h-3 bg-stone-300 dark:bg-zinc-700" />
                                        <span className="flex items-center gap-1">
                                            <span>바람</span>
                                            <span className="font-semibold text-stone-700 dark:text-stone-200">
                                                {weather.windSpeed}m/s
                                            </span>
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>


                    {/* Hourly Timeline */}
                    <div className="mb-8">
                        <div className="flex items-center gap-2 mb-3">
                            <Clock className="w-4 h-4 text-stone-400" />
                            <h3 className="font-bold text-stone-800 dark:text-stone-100 text-sm">시간별 예보</h3>
                        </div>
                        <div className="flex gap-4 overflow-x-auto pb-4 -mx-6 px-6 scrollbar-hide">
                            {weather.timeline?.length > 0 ? weather.timeline.map((item, idx) => {
                                const timeStr = item.time.substring(0, 2) + '시';
                                const isNewDay = idx > 0 && item.date !== weather.timeline[idx - 1].date;
                                return (
                                    <div key={idx} className={`flex flex-col items-center flex-shrink-0 space-y-2 ${isNewDay ? 'border-l pl-4 border-stone-200' : ''} min-w-[3.5rem]`}>
                                        <span className="text-[10px] text-stone-400">{isNewDay ? item.date.substring(4, 6) + '.' + item.date.substring(6, 8) : timeStr}</span>
                                        <WeatherIcon type={item.weatherCode} className="w-6 h-6" isDay={true} />
                                        <span className="text-sm font-bold text-stone-700 dark:text-stone-300">{Math.round(item.temp)}°</span>

                                        {/* Wind Info */}
                                        <div className="flex flex-col items-center gap-0.5 mt-1">
                                            {/* ArrowUp points UP at 0deg. We rotate it. 
                                                Wind Direction 0 (North Wind) means blowing FROM North TO South.
                                                So arrow should point DOWN (180deg). 
                                                Formula: vec + 180. 
                                            */}
                                            <ArrowUp
                                                className="w-3 h-3 text-stone-400"
                                                style={{ transform: `rotate(${(item.vec || 0) + 180}deg)` }}
                                            />
                                            <span className="text-[9px] text-stone-500">{Math.round(item.wsd || 0)}m/s</span>
                                            <span className="text-[8px] text-stone-400">{getWindDirection(item.vec || 0)}</span>
                                        </div>

                                        {item.pop > 0 && <span className="text-[9px] text-blue-500 font-bold">{item.pop}%</span>}
                                    </div>
                                )
                            }) : (
                                <p className="text-xs text-stone-400 w-full text-center">상세 예보 정보가 없습니다.</p>
                            )}
                        </div>
                    </div>

                    {/* Daily Forecast */}
                    <div className="space-y-4">
                        <div className="flex items-center gap-2 mb-2">
                            <CalendarDays className="w-4 h-4 text-stone-400" />
                            <h3 className="font-bold text-stone-800 dark:text-stone-100 text-sm">일별 요약</h3>
                        </div>

                        <div className="space-y-3">
                            {weather.daily.map((day, idx) => {
                                // Format Date: Today, Tomorrow, or Day Name
                                const dateObj = new Date(day.date.substring(0, 4) + '-' + day.date.substring(4, 6) + '-' + day.date.substring(6, 8)); // YYYYMMDD -> Date
                                const isToday = idx === 0;
                                const isTmr = idx === 1; // Assuming array is sequential 0,1,2
                                const label = isToday ? '오늘' : isTmr ? '내일' : format(dateObj, 'E요일', { locale: ko });
                                const dateStr = format(dateObj, 'M.d');

                                return (
                                    <div key={day.date} className="flex items-center justify-between p-4 rounded-xl bg-white dark:bg-zinc-900 border border-stone-100 dark:border-zinc-800 shadow-sm">
                                        <div className="flex items-center gap-3 w-24">
                                            <span className="font-bold text-stone-700 dark:text-stone-200 text-sm">{label}</span>
                                            <span className="text-xs text-stone-400">{dateStr}</span>
                                        </div>

                                        <div className="flex-1 flex justify-center">
                                            <div className="flex flex-col items-center">
                                                <WeatherIcon type={day.weatherCode} className="w-6 h-6" />
                                                {day.pop > 0 && (
                                                    <span className="text-[10px] text-blue-500 font-bold mt-1">{day.pop}%</span>
                                                )}
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-3 w-24 justify-end">
                                            <span className="text-blue-500 font-medium text-sm">{day.min !== null ? Math.round(day.min) : '-'}°</span>
                                            <div className="w-8 h-1 bg-stone-100 rounded-full relative overflow-hidden">
                                                <div className="absolute inset-y-0 left-0 bg-gradient-to-r from-blue-200 to-orange-200 w-full opacity-50" />
                                            </div>
                                            <span className="text-orange-500 font-medium text-sm">{day.max !== null ? Math.round(day.max) : '-'}°</span>
                                        </div>
                                    </div>
                                );
                            })}

                            {weather.daily.length === 0 && !weather.loading && (
                                <p className="text-center text-sm text-stone-400 py-4">예보 정보가 없습니다.</p>
                            )}
                        </div>
                    </div>



                    <div className="mt-8 text-center">
                        <p className="text-[10px] text-stone-300">
                            제공: 기상청 공공데이터포털
                        </p>
                    </div>

                </div>
            </SheetContent>
        </Sheet >
    );
}
