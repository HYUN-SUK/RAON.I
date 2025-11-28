import { Site } from '@/types/reservation';

export const SITES: Site[] = [
    {
        id: 'site-1',
        name: 'Forest Zone A',
        type: 'TENT',
        description: 'A quiet site surrounded by dense forest. Perfect for solo campers.',
        price: 50000,
        maxOccupancy: 4,
        imageUrl: '/images/tent_view_wide_scenic.png',
        features: ['Electricity', 'Wi-Fi', 'Pet Friendly'],
    },
    {
        id: 'site-2',
        name: 'Lake View Glamping',
        type: 'GLAMPING',
        description: 'Luxury glamping with a stunning view of the lake.',
        price: 150000,
        maxOccupancy: 2,
        imageUrl: '/images/tent_view_wide_scenic.png',
        features: ['Bed', 'AC', 'Private BBQ'],
    },
    {
        id: 'site-3',
        name: 'Family Auto Camp',
        type: 'AUTO',
        description: 'Spacious site for large tents and cars. Close to the playground.',
        price: 60000,
        maxOccupancy: 6,
        imageUrl: '/images/tent_view_wide_scenic.png',
        features: ['Electricity', 'Parking', 'Near Shower'],
    },
];
