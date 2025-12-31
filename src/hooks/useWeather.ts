import { useState, useEffect } from 'react';
import { DEFAULT_CAMPING_LOCATION } from '@/constants/location';

// Open-Meteo Weather Codes (WMO)
// 0: Clear sky
// 1, 2, 3: Mainly clear, partly cloudy, and overcast
// 45, 48: Fog
// 51, 53, 55: Drizzle
// 61, 63, 65: Rain
// 71, 73, 75: Snow
// 80, 81, 82: Rain showers
// 95, 96, 99: Thunderstorm

export type WeatherType = 'sunny' | 'cloudy' | 'rainy' | 'snowy' | 'unknown';

interface WeatherState {
    type: WeatherType;
    temp: number | null;
    loading: boolean;
    error: string | null;
}

export const useWeather = (userLat?: number, userLng?: number) => {
    const [weather, setWeather] = useState<WeatherState>({
        type: 'unknown',
        temp: null,
        loading: true,
        error: null,
    });

    useEffect(() => {
        const fetchWeather = async () => {
            // Use user location if available, else default
            const lat = userLat || DEFAULT_CAMPING_LOCATION.latitude;
            const lng = userLng || DEFAULT_CAMPING_LOCATION.longitude;

            const cacheKey = `weather_${lat.toFixed(2)}_${lng.toFixed(2)}`;
            const cached = sessionStorage.getItem(cacheKey);

            // Simple Cache: 1 hour expiry
            if (cached) {
                const parsed = JSON.parse(cached);
                const now = new Date().getTime();
                if (now - parsed.timestamp < 3600 * 1000) {
                    setWeather(parsed.data);
                    return;
                }
            }

            try {
                const response = await fetch(
                    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current_weather=true`
                );
                const data = await response.json();
                const current = data.current_weather;

                const wmoCode = current.weathercode;
                let type: WeatherType = 'sunny';

                if (wmoCode === 0 || wmoCode === 1) type = 'sunny';
                else if (wmoCode >= 2 && wmoCode <= 3) type = 'cloudy';
                else if (wmoCode >= 45 && wmoCode <= 48) type = 'cloudy'; // Fog as cloudy
                else if ((wmoCode >= 51 && wmoCode <= 67) || (wmoCode >= 80 && wmoCode <= 82)) type = 'rainy';
                else if (wmoCode >= 71 && wmoCode <= 77) type = 'snowy';
                else if (wmoCode >= 95) type = 'rainy'; // Thunderstorm as rain

                const weatherData = {
                    type,
                    temp: current.temperature,
                    loading: false,
                    error: null,
                };

                setWeather(weatherData);
                sessionStorage.setItem(cacheKey, JSON.stringify({
                    timestamp: new Date().getTime(),
                    data: weatherData
                }));

            } catch (err) {
                console.warn("Weather fetch failed", err);
                setWeather(prev => ({ ...prev, loading: false, error: "Failed to fetch weather" }));
            }
        };

        fetchWeather();
    }, [userLat, userLng]);

    return weather;
};
