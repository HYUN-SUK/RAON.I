import fetch from 'node-fetch';

async function testPing() {
    console.log("=== raonai.com 접속 테스트 ===");
    try {
        const res = await fetch("https://raonai.com", { method: 'HEAD', timeout: 5000 });
        console.log(`HTTP Status: ${res.status}`);
        console.log(`Headers:`, JSON.stringify(res.headers.raw(), null, 2));
    } catch (e) {
        console.error(`접속 실패 에러: ${e.message}`);
    }
}

testPing();
