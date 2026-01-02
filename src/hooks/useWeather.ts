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

// Open-Meteo Weather Codes (WMO) - (Preserved comments)
// ...

export type WeatherType = 'sunny' | 'partly_cloudy' | 'cloudy' | 'rainy' | 'snowy' | 'unknown';

export interface DailyForecast {
    date: string;
    min: number | null;
    max: number | null;
    pop: number; // Probability of Precipitation
    weatherCode: WeatherType;
    wsd: number;
    vec: number;
}

export interface HourlyForecast {
    date: string;
    time: string;
    temp: number;
    sky: number;
    pty: number;
    pop: number;
    weatherCode: WeatherType;
    wsd: number;
    vec: number;
}

export interface WeatherState {
    type: WeatherType;
    temp: number | null;
    feelsLike: number | null;
    humidity: number;
    windSpeed: number;
    precipitationProbability: number; // POP
    daily: DailyForecast[];
    timeline: HourlyForecast[];

    loading: boolean;
    error: string | null;
}

export const useWeather = (userLat?: number, userLng?: number) => {
    const [weather, setWeather] = useState<WeatherState>({
        type: 'unknown',
        temp: null,
        feelsLike: null,
        humidity: 0,
        windSpeed: 0,
        precipitationProbability: 0,
        daily: [],
        timeline: [],

        loading: true,
        error: null,
    });

    useEffect(() => {
        const fetchWeather = async () => {
            // Use user location if available, else default
            const lat = userLat || DEFAULT_CAMPING_LOCATION.latitude;
            const lng = userLng || DEFAULT_CAMPING_LOCATION.longitude;

            const cacheKey = `weather_kma_${lat.toFixed(2)}_${lng.toFixed(2)}`;
            const cached = sessionStorage.getItem(cacheKey);

            // Simple Session Cache: 30 min expiry
            if (cached) {
                const parsed = JSON.parse(cached);
                const now = new Date().getTime();
                if (now - parsed.timestamp < 1800 * 1000) {
                    setWeather(parsed.data);
                    return;
                }
            }

            try {
                // Call our Proxy API
                const response = await fetch(`/api/weather?lat=${lat}&lng=${lng}`);

                if (!response.ok) {
                    throw new Error('Server API Error');
                }

                const data = await response.json();

                if (data.error) throw new Error(data.error);

                // Map Server Data to UI State
                // Server returns { current: {...}, daily: [...], timeline: [...] }

                const current = data.current;

                // Determine Current Type
                const pty = parseInt(current.strPrecipitation || '0');
                let type: WeatherType = 'sunny';

                if (pty > 0) {
                    if (pty === 1 || pty === 5) type = 'rainy';
                    else if (pty === 3 || pty === 7) type = 'snowy';
                    else type = 'rainy';
                } else {
                    // Check Today's Dominant Forecast from Daily list
                    const todayFcst = data.daily?.[0];
                    if (todayFcst && todayFcst.weatherCode) {
                        type = todayFcst.weatherCode;
                    } else {
                        type = 'sunny';
                    }
                }

                // Probability of Precipitation: Get max POP from today's forecast
                const todayFcst = data.daily?.[0];
                const pop = todayFcst ? todayFcst.pop : 0;

                // Calculate Feels Like (Wind Chill for Winter)
                let feelsLike = current.temp;
                if (current.temp !== null && current.temp <= 10 && current.windSpeed >= 1.3) {
                    const T = current.temp;
                    const V = current.windSpeed * 3.6; // m/s to km/h
                    feelsLike = 13.12 + 0.6215 * T - 11.37 * Math.pow(V, 0.16) + 0.3965 * T * Math.pow(V, 0.16);
                    feelsLike = Math.round(feelsLike * 10) / 10;
                } else if (current.temp !== null) {
                    feelsLike = current.temp; // Fallback to actual temp
                }

                const weatherData: WeatherState = {
                    type,
                    temp: current.temp,
                    feelsLike,
                    humidity: current.humidity,
                    windSpeed: current.windSpeed,
                    precipitationProbability: pop,
                    daily: data.daily || [],
                    timeline: data.timeline || [],
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
