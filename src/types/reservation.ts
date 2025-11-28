export type SiteType = 'TENT' | 'GLAMPING' | 'CARAVAN' | 'AUTO';

export interface Site {
    id: string;
    name: string;
    type: SiteType;
    description: string;
    price: number;
    maxOccupancy: number;
    imageUrl: string;
    features: string[];
}

export type ReservationStatus = 'PENDING' | 'CONFIRMED' | 'CANCELLED';

export interface Reservation {
    id: string;
    userId: string;
    siteId: string;
    checkInDate: Date;
    checkOutDate: Date;
    guests: number;
    totalPrice: number;
    status: ReservationStatus;
    createdAt: Date;
}
