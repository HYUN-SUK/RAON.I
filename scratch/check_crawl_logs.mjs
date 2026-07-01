import fetch from 'node-fetch';

async function check() {
  const url = "https://api.github.com/repos/HYUN-SUK/RAON.I/actions/runs?per_page=10";
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    console.log(`\n=== GitHub Actions Runs (${data.workflow_runs?.length || 0}) ===`);
    data.workflow_runs?.forEach(run => {
      const created = new Date(run.created_at);
      const updated = new Date(run.updated_at);
      const durationMin = Math.round((updated.getTime() - created.getTime()) / 1000 / 60);
      console.log(`[${run.created_at}] Name: ${run.name} | Status: ${run.status} | Conclusion: ${run.conclusion} | Duration: ${durationMin} min`);
      console.log(`  Commit: ${run.head_commit?.message?.substring(0, 50)}`);
      console.log(`  URL: ${run.html_url}`);
      console.log('-'.repeat(40));
    });
  } catch (err) {
    console.error("Error fetching actions runs:", err.message);
  }
}
check();
