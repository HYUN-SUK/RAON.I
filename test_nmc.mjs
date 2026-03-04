async function run() {
    const KEY = '03e41a022f4e6033f803beff860f41460f071cc9482e2532db99c142505f9df2';
    const s1 = encodeURIComponent('충청남도');
    const s2 = encodeURIComponent('예산군');

    // try STAGE1 and STAGE2
    const url = `http://apis.data.go.kr/B552657/ErmctInfoInqireService/getEmrrmRltmUsefulSckbdInfoInqire?serviceKey=${KEY}&STAGE1=${s1}&STAGE2=${s2}&pageNo=1&numOfRows=10&_type=json`;
    console.log("URL:", url);
    const res = await fetch(url);
    const text = await res.text();
    console.log(text.substring(0, 500));
}
run();
