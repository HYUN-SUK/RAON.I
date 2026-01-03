
const fetch = require('node-fetch'); // Ensure node-fetch is available or use native fetch in newer node

// User provided key
const SERVICE_KEY = '03e41a022f4e6033f803beff860f41460f071cc9482e2532db99c142505f9df2';

async function checkOfficialAPI(year) {
    // Determine if the key needs encoding. Usually it does if it's already decoded.
    // Try sending it as is first.
    // Endpoint: getRestDeInfo (Public Holidays)
    const url = `http://apis.data.go.kr/B090041/openapi/service/SpcdeInfoService/getRestDeInfo?solYear=${year}&ServiceKey=${SERVICE_KEY}&numOfRows=100&_type=json`;

    console.log(`Fetching for ${year}...`);
    try {
        const res = await fetch(url);
        const text = await res.text();
        console.log('Response Status:', res.status);
        console.log('Response Body Preview:', text.substring(0, 500));

        try {
            const data = JSON.parse(text);
            if (data.response?.body?.items?.item) {
                const items = Array.isArray(data.response.body.items.item)
                    ? data.response.body.items.item
                    : [data.response.body.items.item];

                console.log(`Found ${items.length} holidays for ${year}:`);
                items.forEach(item => {
                    console.log(`${item.locdate} (${item.dateName}) - isHoliday: ${item.isHoliday}`);
                });
            } else {
                console.log('No items found or unexpected structure.');
            }
        } catch (e) {
            console.log('Response is not JSON (likely XML error):', e.message);
        }

    } catch (e) {
        console.error('Fetch failed:', e);
    }
}

(async () => {
    await checkOfficialAPI(2026);
})();
