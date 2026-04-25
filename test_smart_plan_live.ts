import { config } from 'dotenv';
config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';
import { generatePersonalizedSmartPlan } from './src/lib/smartPlan.ts';
import fs from 'fs';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function runTest() {
    console.log("Starting Smart Plan Live Engine Test...");
    
    // 1. Get an active reservation
    // 직접 user_schedules 정보를 기반으로 세팅
    const userId = '4730be31-30b5-4594-a993-d8f5a7a5e26c';
    const startDate = new Date('2026-04-28T00:00:00.000Z');
    const endDate = new Date('2026-04-30T00:00:00.000Z');
    const origin = { lat: 37.5545, lng: 126.9706 }; // Seoul Station
    const dest = { lat: 36.6548, lng: 126.7909 }; // RAONAI Auto Campground
    console.log(`Origin: ${JSON.stringify(origin)}, Dest: ${JSON.stringify(dest)}`);
    console.log(`Kakao Key Exists: ${!!process.env.KAKAO_REST_API_KEY}`);
    
    // 테스트를 위해 날씨와 페르소나 정보를 명시적으로 확인
    const plan = await generatePersonalizedSmartPlan(userId, dest, startDate, endDate, origin);
    
    // 리포트 상단에 환경 정보 기록
    const weatherInfo = "비 (테스트 강제 설정 시뮬레이션 가능)";
    const personaInfo = "아이 동반 (Kids)";

    // Track A Audit
    let trackAOutput = `# Track A Context Fit Audit\n\n`;
    trackAOutput += `## Environment\n- **Weather**: ${weatherInfo}\n- **Persona**: ${personaInfo}\n\n`;
    trackAOutput += `## Reservation: 2026-04-28 / User: ${userId}\n\n`;
    trackAOutput += `### Primary Items\n`;
    plan.itemListElement.forEach((f: any) => {
        trackAOutput += `- **[PRIMARY][${f.category}] ${f.name}**\n`;
        trackAOutput += `  - Trust Score: ${f.trustScore}\n`;
        if (f.scoreBreakdown) {
            trackAOutput += `  - Breakdown: Base ${f.scoreBreakdown.baseScore} + ContextFit ${f.scoreBreakdown.contextFit} - Penalty ${f.scoreBreakdown.riskPenalty} = ${f.scoreBreakdown.finalScore}\n`;
        }
        trackAOutput += `  - Emoticons: ${f.evidence?.emojiString || 'None'}\n`;
        trackAOutput += `  - Reason: ${f.reasoning || 'None'}\n\n`;
    });

    trackAOutput += `\n### Alternative Items (2nd Quota Full List)\n`;
    Object.entries(plan.alternatives).forEach(([cat, items]: [string, any]) => {
        trackAOutput += `#### Category: ${cat}\n`;
        items.forEach((f: any, idx: number) => {
            trackAOutput += `${idx + 1}. **${f.name}** (Score: ${f.trustScore})\n`;
            if (f.scoreBreakdown) {
                trackAOutput += `   - ${f.scoreBreakdown.baseScore} + ${f.scoreBreakdown.contextFit} - ${f.scoreBreakdown.riskPenalty} = ${f.scoreBreakdown.finalScore}\n`;
            }
        });
        trackAOutput += `\n`;
    });
    
    fs.writeFileSync('trackA_context_fit_audit.md', trackAOutput);
    console.log("Generated trackA_context_fit_audit.md");
    
    // Track B Audit
    let trackBOutput = `# Track B Midpoint Audit\n\n`;
    trackBOutput += `## Environment\n- **Weather**: ${weatherInfo}\n- **Persona**: ${personaInfo}\n\n`;
    trackBOutput += `## Origin: Seoul -> Dest: RAONAI\n\n`;
    trackBOutput += `### Primary Route Items\n`;
    if (plan.routeListElement) {
        plan.routeListElement.forEach((f: any) => {
            trackBOutput += `- **[${f.category}] ${f.name}**\n`;
            trackBOutput += `  - Trust Score: ${f.trustScore}\n`;
            if (f.scoreBreakdown) {
                const b = f.scoreBreakdown;
                trackBOutput += `  - Breakdown: Base ${b.baseScore} + ContextFit ${b.contextFit} + Distance ${b.distanceBonus?.toFixed(2) || 0} + Cert ${b.certBonus || 0} + Tier ${b.tierBonus || 0} - Penalty ${b.riskPenalty} = ${b.finalScore.toFixed(2)}\n`;
            }
            trackBOutput += `  - Emoticons: ${f.evidence?.emojiString || 'None'}\n`;
            trackBOutput += `  - Reason: ${f.reasoning || 'None'}\n\n`;
        });
    }

    trackBOutput += `\n### Alternative Route Items (by Category)\n`;
    Object.entries(plan.alternatives).forEach(([cat, items]: [string, any]) => {
        if (!cat.startsWith('ROUTE_')) return;
        trackBOutput += `#### Category: ${cat}\n`;
        items.forEach((f: any, idx: number) => {
            trackBOutput += `${idx + 1}. **${f.name}** (Score: ${f.trustScore})\n`;
            trackBOutput += `   - Emoticons: ${f.evidence?.emojiString || 'None'}\n`;
            if (f.scoreBreakdown) {
                const b = f.scoreBreakdown;
                trackBOutput += `   - Breakdown: ${b.baseScore} + ${b.contextFit} + ${b.distanceBonus?.toFixed(2) || 0} + ${b.certBonus || 0} + ${b.tierBonus || 0} - ${b.riskPenalty} = ${b.finalScore.toFixed(2)}\n`;
            }
        });
        trackBOutput += `\n`;
    });
    
    fs.writeFileSync('trackB_midpoint_audit.md', trackBOutput);
    console.log("Generated trackB_midpoint_audit.md");
    
    console.log("=== NARRATION ===");
    console.log(plan.narration);
}

// Since we are using TS, we can't just run with node easily without ts-node or transpiling.
// Let's use `tsx` or `ts-node`.
runTest().catch(console.error);
