
export interface WeatherData {
    temp: number;
    weatherCode: 'sunny' | 'cloudy' | 'partly_cloudy' | 'rainy' | 'snowy';
    humidity?: number;
    windSpeed?: number;
}

export interface KMAResponse {
    response: {
        header: {
            resultCode: string;
            resultMsg: string;
        };
        body: {
            dataType: string;
            items: {
                item: any[];
            };
        };
    };
}
