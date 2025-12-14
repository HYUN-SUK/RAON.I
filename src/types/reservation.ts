export type SiteType = 'TENT' | 'GLAMPING' | 'CARAVAN' | 'AUTO';

export interface Site {
    id: string;
    name: string;
    type: SiteType;
    description: string;
    price: number; // 1박 기본 요금 (평일/비성수기 기준)
    basePrice: number; // SSOT: 기준 가격
    maxOccupancy: number;
    imageUrl: string;
    features: string[];
}

export type ReservationStatus = 'PENDING' | 'CONFIRMED' | 'CANCELLED' | 'COMPLETED' | 'NO-SHOW';

export interface Reservation {
    id: string;
    userId: string;
    siteId: string;
    checkInDate: Date;
    checkOutDate: Date;
    familyCount: number; // SSOT: 기본 1가족
    visitorCount: number; // SSOT: 방문객 수
    vehicleCount: number; // SSOT: 차량 수
    guests: number; // 총 인원 (가족 구성원 + 방문객)
    totalPrice: number;
    status: ReservationStatus;
    requests: string; // SSOT: 요청사항
    createdAt: Date;
}

export interface PriceBreakdown {
    basePrice: number;
    options: {
        extraFamily: number;
        visitor: number;
    };
    discount: {
        consecutive: number;
        package: number;
    };
    totalPrice: number;
    nights: number;
}

export interface Season {
    name: string;
    startMonth: number; // 0-11
    startDay: number; // 1-31
    endMonth: number;
    endDay: number;
}

export interface PricingConfig {
    weekday: number;
    weekend: number;
    peakWeekday: number;
    peakWeekend: number;
    extraFamily: number;
    visitor: number;
    longStayDiscount: number;
    seasons: Season[];
}

export interface BlockedDate {
    id: string; // uuid
    siteId: string | 'ALL';
    date: Date; // stored as Date object in store (handled by storage)
    memo?: string;
}
