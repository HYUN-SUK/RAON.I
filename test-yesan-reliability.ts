import { generateSmartPlan } from './src/lib/smartPlan';
import { UserPersona } from './src/lib/persona';
import dotenv from 'dotenv';
import { webcrypto } from 'node:crypto';

// Polyfill for Node.js
if (!globalThis.crypto) {
    (globalThis as any).crypto = webcrypto;
}

dotenv.config({ path: '.env.local' });

async function runTest() {
    console.log('--- Yesan Reliability Verification ---');
    
    const persona: UserPersona = {
        description: "맛을 중요하게 생각하는 가족",
        guestDetails: { adults: 2, kids: { preschool: 0, elementary: 1, teen: 0 } },
        topTags: ["맛집", "로컬"]
    };

    const location = { lat: 36.6345, lng: 126.8234 }; // 할머니어죽 위치
    
    try {
        const plan = await generateSmartPlan(persona, location, new Date(), new Date());
        const place = plan.itemListElement.find(f => f.name === '할머니어죽');
        
        if (place) {
            console.log('\n✅ Verification Success: 할머니어죽 found');
            console.log('- Trust Score:', place.trustScore); // Should be 100
            console.log('- Sources:', place.metadata?.certificationCount); // Should be 3
            console.log('- Bonus:', place.metadata?.certificationBonus); // Should be 30
            console.log('- Badges:', place.evidence?.badges);
            
            if (place.trustScore === 100 && place.metadata?.certificationBonus === 30) {
                console.log('\n🏆 FINAL RESULT: Reliability logic successfully applied to real-world overlaps!');
            }
        } else {
            console.log('\n❌ Verification Failed: 할머니어죽 not found in plan results.');
            console.log('Existing items:', plan.itemListElement.map(i => i.name).join(', '));
        }
    } catch (e) {
        console.error('Test Error:', e);
    }
}

runTest();
