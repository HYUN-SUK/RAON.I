import fetch from 'node-fetch';

const lat = 37.15;
const lng = 127.08;
const targetUrl = `http://localhost:3000/api/weather?lat=${lat}&lng=${lng}`;

async function test() {
    console.log('Testing Self-fetch: ', targetUrl);
    try {
        const res = await fetch(targetUrl);
        const text = await res.text();
        console.log('Status:', res.status);
        console.log('Response:', text.substring(0, 1000));
    } catch (e) {
        console.error('Self-fetch failed with error:', e.message);
    }
}

test();
