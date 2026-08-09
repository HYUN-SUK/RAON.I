import fetch from 'node-fetch';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve('.env.local') });

// We can read github workflow status using github api
// GET /repos/{owner}/{repo}/actions/workflows/{workflow_id}/runs
async function run() {
  console.log("🔍 [GitHub Actions Check] Fetching runs for daily-region-sync.yml...");
  
  const token = process.env.GITHUB_PAT || ""; // we can try standard env or authorization token
  const url = `https://api.github.com/repos/HYUN-SUK/RAON.I/actions/workflows/daily-region-sync.yml/runs?per_page=5`;
  
  const headers = {
    'Accept': 'application/vnd.github+json',
    'User-Agent': 'antigravity-agent'
  };
  
  // Use authorization if we have token in .env or hardcoded for a moment
  // For safety, let's just query publicly if the repo is public, or try to use a local shell script.
  // Wait, is the repository public or private? Let's check git remote url first.
  
  try {
    const res = await fetch(url, { headers });
    if (!res.ok) {
      console.error(`❌ HTTP Error: ${res.status} ${res.statusText}`);
      // If unauthorized, we might need token. Let's try git log or git command to check if github CLI is logged in.
      return;
    }
    const data = await res.json();
    console.log(`📊 Found ${data.workflow_runs?.length || 0} runs:\n`);
    data.workflow_runs?.forEach((r, idx) => {
      console.log(`[${idx + 1}] ID: ${r.id}`);
      console.log(`    Status: ${r.status} | Conclusion: ${r.conclusion}`);
      console.log(`    Trigger: ${r.event} | Branch: ${r.head_branch}`);
      console.log(`    Created: ${new Date(r.created_at).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}`);
      console.log(`    URL: ${r.html_url}`);
      console.log("-".repeat(60));
    });
  } catch (err) {
    console.error("💥 Error querying GitHub Actions:", err);
  }
}

run();
