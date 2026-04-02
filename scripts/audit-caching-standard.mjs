import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import chalk from 'chalk';

dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function audit() {
    console.log(chalk.blue.bold("\n[RAONAI D-3 Caching Precision Audit v11.9.2]"));
    
    // Default to today/tomorrow's data
    const startTime = new Date().toISOString().split('T')[0] + 'T00:00:00Z';
    
    console.log(`  -> Audit Period: >= ${startTime}\n`);

    const { data: facts, error } = await supabase
        .from('smart_camping_plan_facts')
        .select('id, category, trust_score, raw_data, created_at')
        .gte('created_at', startTime);

    if (error) {
        console.error(chalk.red("  Error fetching facts:"), error);
        return;
    }

    if (!facts || facts.length === 0) {
        console.log(chalk.yellow("  ! No cached data found for the target period. (Ground Zero)"));
        return;
    }

    const stats = {};
    const categories = ['RESTAURANT', 'SPOT', 'MART', 'HOSPITAL', 'GAS_STATION', 'FESTIVAL'];
    
    categories.forEach(cat => {
        stats[cat] = { count: 0, totalScore: 0, hasCoords: 0, total: 0 };
    });

    facts.forEach(f => {
        const cat = f.category;
        if (!stats[cat]) stats[cat] = { count: 0, totalScore: 0, hasCoords: 0, total: 0 };
        
        stats[cat].count++;
        stats[cat].totalScore += (f.trust_score || 0);
        
        const rd = f.raw_data || {};
        if (rd.lat && rd.lng) stats[cat].hasCoords++;
    });

    console.log(chalk.white.bold("--------------------------------------------------------------------------------"));
    console.log(chalk.white.bold("| Category       | Count | Target | Avg Score | Coord Reg % | Status      |"));
    console.log(chalk.white.bold("--------------------------------------------------------------------------------"));

    const targets = { RESTAURANT: 300, SPOT: 300, MART: 100, HOSPITAL: 15, GAS_STATION: 20, FESTIVAL: 0 };

    Object.keys(stats).sort().forEach(cat => {
        const s = stats[cat];
        const target = targets[cat] || 0;
        const avgScore = s.count > 0 ? (s.totalScore / s.count).toFixed(1) : "0.0";
        const coordReg = s.count > 0 ? ((s.hasCoords / s.count) * 100).toFixed(1) : "0.0";
        
        let status = chalk.green("PASS");
        if (target > 0 && s.count < target) status = chalk.red("FAIL");
        else if (target > 0 && s.count < target * 0.9) status = chalk.yellow("WARN");

        console.log(
            `| ${cat.padEnd(14)} | ${String(s.count).padStart(5)} | ${String(target).padStart(6)} | ${avgScore.padStart(9)} | ${coordReg.padStart(10)}% | ${status.padEnd(20)} |`
        );
    });

    console.log(chalk.white.bold("--------------------------------------------------------------------------------"));
    console.log(`  Total Items Cached: ${facts.length}`);
    console.log(chalk.cyan.italic("\n  [Action] If FAIL: Re-run node scripts/caching-smart-plan.mjs --target-date=YYYY-MM-DD"));
}

audit();
