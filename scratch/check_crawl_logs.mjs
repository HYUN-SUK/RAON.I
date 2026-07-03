import fetch from 'node-fetch';

async function check() {
  const runId = "28624439169";
  const url = `https://api.github.com/repos/HYUN-SUK/RAON.I/actions/runs/${runId}/annotations`;
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    console.log(`\n=== GitHub Run ${runId} Annotations ===`);
    console.log(JSON.stringify(data, null, 2));
  } catch (err) {
    console.error("Error fetching run annotations:", err.message);
  }
}
check();
