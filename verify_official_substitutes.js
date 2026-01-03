
const fetch = require('node-fetch');

// The key provided by user
const SERVICE_KEY = '03e41a022f4e6033f803beff860f41460f071cc9482e2532db99c142505f9df2';

async function verifySubstitutes(year) {
    const url = `http://apis.data.go.kr/B090041/openapi/service/SpcdeInfoService/getRestDeInfo?solYear=${year}&ServiceKey=${SERVICE_KEY}&numOfRows=100&_type=json`;

    console.log(`Fetching ${year} to verify substitutes...`);
    try {
        const res = await fetch(url);
        const text = await res.text();

        try {
            const data = JSON.parse(text);
            const items = data.response?.body?.items?.item || [];
            const holidayDates = items.map(i => String(i.locdate)); // YYYYMMDD string

            // 2026 Substitute Holidays to check
            const targets = [
                { date: '20260302', name: 'Mar 2 Substitute' },
                { date: '20260525', name: 'May 25 Substitute' },
                { date: '20260817', name: 'Aug 17 Substitute' },
                { date: '20261005', name: 'Oct 5 Substitute' }
            ];

            let allFound = true;
            targets.forEach(t => {
                if (holidayDates.includes(t.date)) {
                    console.log(`[OK] Found ${t.name} (${t.date})`);
                } else {
                    console.log(`[FAIL] Missing ${t.name} (${t.date})`);
                    allFound = false;
                }
            });

            if (allFound) {
                console.log("VERIFICATION PASSED: All substitute holidays are present.");
            } else {
                console.log("VERIFICATION FAILED: Some substitute holidays are missing.");
            }

        } catch (e) {
            console.log('JSON Parse Error:', e.message);
            console.log('Raw output:', text.substring(0, 500));
        }

    } catch (e) {
        console.error('Fetch Error:', e);
    }
}

(async () => {
    await verifySubstitutes(2026);
})();
