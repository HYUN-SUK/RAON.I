import { spawnSync } from 'child_process';
import fs from 'fs';

const limit = 1000;
const scanMax = 200000; // 테이블 전체 17만 건을 완전히 순회하기 위한 최대 스캔 한도
let scannedTotal = 0;

// CLI 인수에서 --billing 및 --dry-run 옵션 전달
const args = process.argv.slice(2);
const billingMode = args.includes('--billing') ? args[args.indexOf('--billing') + 1] : 'paid';
const dryRun = args.includes('--dry-run');

console.log(`=== Starting Gemini Description Preloading Loop Runner ===`);
console.log(`Scan Limit: ${scanMax}, Limit per batch: ${limit}, Billing: ${billingMode}, Dry-Run: ${dryRun}`);

// 시작 전 scratch 디렉토리 및 last_gemini_cursor_id.txt 파일 확보
if (!fs.existsSync('scratch/last_gemini_cursor_id.txt')) {
  fs.mkdirSync('scratch', { recursive: true });
  fs.writeFileSync('scratch/last_gemini_cursor_id.txt', '', 'utf8');
}

while (scannedTotal < scanMax) {
  const lastId = fs.readFileSync('scratch/last_gemini_cursor_id.txt', 'utf8').trim();
  console.log(`\n--- Gemini Batch scan start. Scanned so far: ${scannedTotal}. Cursor Last ID: [${lastId || 'START OF TABLE'}] ---`);

  const runArgs = [
    'scripts/gemini-enrich-description.mjs',
    '--limit', limit.toString(),
    '--billing', billingMode
  ];
  
  if (lastId) {
    runArgs.push('--last-id', lastId);
  }
  if (dryRun) {
    runArgs.push('--dry-run');
  }

  const result = spawnSync('node', runArgs, { stdio: 'inherit' });

  if (result.status !== 0) {
    console.error(`\n🚨 [GEMINI LOOP ABORTED] Child process exited with non-zero code: ${result.status}. Stopping loop.`);
    console.log(`💡 Cursor state saved at 'scratch/last_gemini_cursor_id.txt'. Run again to resume.`);
    process.exit(result.status || 1);
  }

  scannedTotal += limit;

  // 자식 프로세스가 테이블 끝에 도달하여 last_gemini_cursor_id.txt 가 빈 값이 되었는지 다시 확인
  const nextLastId = fs.readFileSync('scratch/last_gemini_cursor_id.txt', 'utf8').trim();
  if (nextLastId === '') {
    console.log(`\n🎉 === Table scan complete! End of master_places table reached for description enrichment. ===`);
    break;
  }

  // 드라이런 모드 시에는 1회 기동 후 중단하여 확인 가능하게 처리
  if (dryRun) {
    console.log(`\n💡 Dry-Run batch completed. Stopping loop.`);
    break;
  }

  console.log(`Scanned chunk complete. Sleeping for 1.5 seconds...`);
  spawnSync('node', ['-e', 'new Promise(r => setTimeout(r, 1500))']);
}

console.log(`\n🎉 === All gemini description preloading batches completed! Total scanned: ${scannedTotal} ===`);
