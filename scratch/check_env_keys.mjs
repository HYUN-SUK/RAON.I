import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

console.log('MOIS_API_KEY 존재 여부:', Boolean(process.env.MOIS_API_KEY));
console.log('PUBLIC_DATA_API_KEY 존재 여부:', Boolean(process.env.PUBLIC_DATA_API_KEY));
console.log('DATA_GO_KR_API_KEY 존재 여부:', Boolean(process.env.DATA_GO_KR_API_KEY));
console.log('KMA_SERVICE_KEY 존재 여부:', Boolean(process.env.KMA_SERVICE_KEY));
console.log('TOUR_API_KEY 존재 여부:', Boolean(process.env.TOUR_API_KEY));
console.log('TMAP_API_KEY 존재 여부:', Boolean(process.env.TMAP_API_KEY || process.env.NEXT_PUBLIC_TMAP_API_KEY || process.env.SK_OPENAPI_KEY));
