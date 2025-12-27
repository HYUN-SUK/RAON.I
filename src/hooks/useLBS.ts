import { useState, useEffect } from 'react';

// Default Location: RAON Camping (Dummy Coordinates for Demo)
// Using Gapyeong-gun coordinates as a generic "Campsite" location
const DEFAULT_LOCATION = {
    latitude: 37.8315,
    longitude: 127.5097,
};

interface Coordinates {
    latitude: number;
    longitude: number;
}

interface LBSState {
    location: Coordinates;
    isLoading: boolean;
    error: string | null;
    usingDefault: boolean;
}

export const useLBS = () => {
    const [state, setState] = useState<LBSState>({
        location: DEFAULT_LOCATION,
        isLoading: true,
        error: null,
        usingDefault: true,
    });

    useEffect(() => {
        if (!navigator.geolocation) {
            setState(prev => ({
                ...prev,
                isLoading: false,
                error: "Geolocation is not supported by this browser.",
                usingDefault: true
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
                usingDefault: false,
            });
        };

        const handleError = (error: GeolocationPositionError) => {
            console.warn("LBS Access Denied/Error:", error.message);
            // Fallback to default without blocking the UI
            setState({
                location: DEFAULT_LOCATION,
                isLoading: false,
                error: error.message,
                usingDefault: true, // Mark as using default so UI can show "Campsite Base" vs "My Location"
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

    const deg2rad = (deg: number) => {
        return deg * (Math.PI / 180);
    };

    return { ...state, getDistanceKm };
};
