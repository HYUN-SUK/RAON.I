import { NextResponse } from 'next/server';

const SERVICE_KEY = '03e41a022f4e6033f803beff860f41460f071cc9482e2532db99c142505f9df2';

interface HolidayItem {
    dateKind: string;
    dateName: string;
    isHoliday: string;
    locdate: number;
    seq: string;
}

export async function GET() {
    // Fetch 2025 and 2026
    const years = [2025, 2026];
    const holidays = new Set<string>();

    try {
        for (const year of years) {
            // Official API Endpoint: getRestDeInfo
            const url = `http://apis.data.go.kr/B090041/openapi/service/SpcdeInfoService/getRestDeInfo?solYear=${year}&ServiceKey=${SERVICE_KEY}&numOfRows=100&_type=json`;

            try {
                const res = await fetch(url);
                if (!res.ok) {
                    console.error(`Failed to fetch ${year}:`, res.status, res.statusText);
                    continue;
                }

                const text = await res.text();
                // Basic JSON parsing (API returns JSON string if _type=json is honored, sometimes it wraps in XML if error, but user confirmed JSON works)
                let data;
                try {
                    data = JSON.parse(text);
                } catch (e) {
                    console.error('Failed to parse JSON response:', text.substring(0, 100));
                    continue;
                }

                const items = data.response?.body?.items?.item;
                if (!items) continue;

                const holidayList: HolidayItem[] = Array.isArray(items) ? items : [items];

                holidayList.forEach((item) => {
                    if (item.isHoliday === 'Y') {
                        // locdate is number like 20260302 -> Convert to 2026-03-02
                        const str = String(item.locdate);
                        const formatted = `${str.substring(0, 4)}-${str.substring(4, 6)}-${str.substring(6, 8)}`;
                        holidays.add(formatted);
                    }
                });

            } catch (innerError) {
                console.error(`Error processing year ${year}:`, innerError);
            }
        }

        // Manual Injection of Substitute Holidays (2025-2026)
        // These are added to ensure they exist even if the API misses them or fails.
        const ADDITIONAL_HOLIDAYS = [
            '2025-03-03', // Substitute for Samiljeol (Mar 1 Sat)
            '2025-05-06', // Substitute for Buddha\'s Birthday (May 5 Mon overlap handling)
            '2025-10-08', // Substitute for Chuseok (Oct 5 Sun)
            '2026-03-02', // Substitute for Samiljeol (Mar 1 Sun)
            '2026-05-25', // Substitute for Buddha\'s Birthday (May 24 Sun)
            '2026-08-17', // Substitute for Liberation Day (Aug 15 Sat)
            '2026-10-05', // Substitute for National Foundation Day (Oct 3 Sat)
        ];

        ADDITIONAL_HOLIDAYS.forEach(date => holidays.add(date));

        const uniqueHolidays = Array.from(holidays).sort();

        return NextResponse.json({ holidays: uniqueHolidays });
    } catch (e) {
        console.error('Failed to fetch holidays handler:', e);
        return NextResponse.json({ error: 'Failed to fetch holidays' }, { status: 500 });
    }
}
