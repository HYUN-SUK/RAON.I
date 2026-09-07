import { useState, useEffect } from 'react';
import { DEFAULT_CAMPING_LOCATION } from '@/constants/location';

interface Coordinates {
    latitude: number;
    longitude: number;
}

interface LBSState {
    location: Coordinates;
    isLoading: boolean;
    error: string | null;
    errorCode: number | null;
    usingDefault: boolean;
    permissionStatus: 'granted' | 'prompt' | 'denied' | 'unknown';
}

const deg2rad = (deg: number) => {
    return deg * (Math.PI / 180);
};

export const useLBS = () => {
    const [state, setState] = useState<LBSState>({
        location: DEFAULT_CAMPING_LOCATION,
        isLoading: true,
        error: null,
        errorCode: null,
        usingDefault: true,
        permissionStatus: 'unknown',
    });

    useEffect(() => {
        // 권한 상태 사전 확인
        if (typeof navigator !== 'undefined' && navigator.permissions) {
            try {
                navigator.permissions.query({ name: 'geolocation' as PermissionName }).then((status) => {
                    setState(prev => ({ ...prev, permissionStatus: status.state as any }));
                    status.onchange = () => {
                        setState(prev => ({ ...prev, permissionStatus: status.state as any }));
                    };
                }).catch(() => {});
            } catch {}
        }

        if (!navigator.geolocation) {
            setState(prev => ({
                ...prev,
                isLoading: false,
                error: "Geolocation is not supported by this browser.",
                errorCode: null,
                usingDefault: true,
                permissionStatus: 'denied',
            }));
            return;
        }

        const handleSuccess = (position: GeolocationPosition) => {
            setState({
                location: {
                    latitude: position.coords.latitude,
                    longitude: position.coords.longitude,
                },
                isLoading: false,
                error: null,
                errorCode: null,
                usingDefault: false,
                permissionStatus: 'granted',
            });
        };

        const handleError = (error: GeolocationPositionError) => {
            console.warn("LBS Access Denied/Error:", error.message, "code:", error.code);
            // Fallback to default without blocking the UI
            setState({
                location: DEFAULT_CAMPING_LOCATION,
                isLoading: false,
                error: error.message,
                errorCode: error.code,
                usingDefault: true, // Mark as using default so UI can show "Campsite Base" vs "My Location"
                permissionStatus: error.code === 1 ? 'denied' : 'prompt',
            });
        };

        // Timeout: 5s
        navigator.geolocation.getCurrentPosition(handleSuccess, handleError, {
            enableHighAccuracy: true,
            timeout: 5000,
            maximumAge: 0,
        });
    }, []);

    // Util: Get distance in km
    const getDistanceKm = (targetLat: number, targetLng: number) => {
        const R = 6371; // Radius of the earth in km
        const dLat = deg2rad(targetLat - state.location.latitude);
        const dLon = deg2rad(targetLng - state.location.longitude);
        const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(deg2rad(state.location.latitude)) *
            Math.cos(deg2rad(targetLat)) *
            Math.sin(dLon / 2) *
            Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        const d = R * c; // Distance in km
        return parseFloat(d.toFixed(1)); // Return 1 decimal place
    };

    return { ...state, getDistanceKm };
};
