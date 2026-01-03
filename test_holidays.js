
const { getHolidays } = require('@kyungseopk1m/holidays-kr');

(async () => {
    console.log('--- 2026 Holidays (holidays-kr) ---');
    // usage might be async or require arguments?
    // checking docs via web search or assuming standard.
    // actually, most of these use the API, so they might fail without a key.
    // but some bundle data.
    try {
        const holidays = await getHolidays({ year: 2026 });
        console.log(holidays);
    } catch (e) {
        console.error("Failed:", e.message);
    }
})();

