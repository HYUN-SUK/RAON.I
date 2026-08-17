import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const SAFE_API_KEY = process.env.SAFE_RESTAURANT_API_KEY;

async function findJeonnamSidoNames() {
    // 1000개 가져와서 RELAX_SI_NM 종류 확인
    const uniqueSidos = new Set();
    for (let page = 1; page <= 10; page++) {
        const start = (page - 1) * 1000 + 1;
        const end = page * 1000;
        const url = `http://211.237.50.150:7080/openapi/${SAFE_API_KEY}/json/Grid_20200713000000000605_1/${start}/${end}`;
        const res = await fetch(url);
        const d = await res.json();
        const rows = d.Grid_20200713000000000605_1?.row || [];
        rows.forEach(r => {
            if (r.RELAX_SI_NM) uniqueSidos.add(r.RELAX_SI_NM);
        });
    }
    console.log('농식품부 안심식당에 존재하는 RELAX_SI_NM 목록:');
    console.log(Array.from(uniqueSidos));
}

findJeonnamSidoNames();
