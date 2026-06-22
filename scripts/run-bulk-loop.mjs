import { spawnSync } from 'child_process';
import fs from 'fs';

const limit = 1000;
const concurrency = 8;
const scanMax = 200000; // 테이블 전체 17만 건을 완전히 순회하기 위한 최대 스캔 횟수
let scannedTotal = 0;

console.log(`=== Starting Bulk Loop Runner (Cursor Pagination) ===`);
console.log(`Scan Limit: ${scanMax}, Limit per batch: ${limit}, Concurrency: ${concurrency}`);

// 시작 전 last_cursor_id.txt가 없으면 빈 값으로 기동
if (!fs.existsSync('scratch/last_cursor_id.txt')) {
  fs.mkdirSync('scratch', { recursive: true });
  fs.writeFileSync('scratch/last_cursor_id.txt', '', 'utf8');
}

while (scannedTotal < scanMax) {
  const lastId = fs.readFileSync('scratch/last_cursor_id.txt', 'utf8').trim();
  console.log(`\n--- Batch scan start. Scanned so far: ${scannedTotal}. Cursor Last ID: [${lastId || 'START OF TABLE'}] ---`);

  const args = [
    'scripts/fast-bulk-enrich.mjs',
    '--limit', limit.toString(),
    '--concurrency', concurrency.toString()
  ];
  if (lastId) {
    args.push('--last-id', lastId);
  }

  const result = spawnSync('node', args, { stdio: 'inherit' });

  if (result.status !== 0) {
    console.error(`\n🚨 [LOOP ABORTED] Child process exited with non-zero code: ${result.status}. Stopping loop.`);
    process.exit(result.status || 1);
  }

  // 다음 루프를 위해 스캔 횟수 누적
  scannedTotal += limit;

  // 자식 프로세스가 테이블 끝에 도달하여 last_cursor_id.txt가 빈 값이 되었는지 다시 확인
  const nextLastId = fs.readFileSync('scratch/last_cursor_id.txt', 'utf8').trim();
  if (nextLastId === '') {
    console.log(`\n🎉 === Table scan complete! End of master_places table reached. ===`);
    break;
  }

  console.log(`Scanned chunk complete. Sleeping for 1 second...`);
  spawnSync('node', ['-e', 'new Promise(r => setTimeout(r, 1000))']);
}

console.log(`\n🎉 === All bulk batches completed successfully! Total scanned: ${scannedTotal} ===`);
