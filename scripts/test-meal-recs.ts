
import { getMealRecommendation } from '../src/lib/meal-recommendation';

const scenarios = [
    { name: 'Rainy Day', weather: { temp: 20, weatherCode: 'rainy' as const }, memberCount: 4, withKids: false },
    { name: 'Cold Winter', weather: { temp: -5, weatherCode: 'snowy' as const }, memberCount: 4, withKids: false },
    { name: 'Hot Summer', weather: { temp: 32, weatherCode: 'sunny' as const }, memberCount: 4, withKids: false },
    { name: 'Family with Kids', weather: { temp: 22, weatherCode: 'cloudy' as const }, memberCount: 4, withKids: true },
    { name: 'Large Group', weather: { temp: 18, weatherCode: 'sunny' as const }, memberCount: 8, withKids: false },
];

console.log('--- Meal Recommendation Logic Test ---');
scenarios.forEach(s => {
    console.log(`\n[Scenario: ${s.name}]`);
    const recs = getMealRecommendation(s.weather, s.memberCount, s.withKids);
    recs.forEach(r => console.log(`- ${r.title}: ${r.reason}`));
});
