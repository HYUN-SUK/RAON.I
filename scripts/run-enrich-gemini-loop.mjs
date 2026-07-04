import { spawnSync } from 'child_process';
import fs from 'fs';

const limit = 50; // 기본 배치 제한
const scanMax = 200000; // 최대 스캔 레코드 수
let scannedTotal = 0;

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const limitArg = args.includes('--limit') ? args[args.indexOf('--limit') + 1] : limit.toString();

console.log(`=== Starting Gemini Mart Description Loop Runner ===`);
console.log(`Scan Limit: ${scanMax}, Limit per batch: ${limitArg}, Dry-Run: ${dryRun}`);

const cursorFile = 'scratch/last_gemini_cursor_id.txt';

if (!fs.existsSync(cursorFile)) {
  fs.mkdirSync('scratch', { recursive: true });
  fs.writeFileSync(cursorFile, '', 'utf8');
}

while (scannedTotal < scanMax) {
  const lastId = fs.readFileSync(cursorFile, 'utf8').trim();
  console.log(`\n--- Batch scan start. Scanned so far: ${scannedTotal}. Cursor Last ID: [${lastId || 'START OF TABLE'}] ---`);

  const runArgs = [
    'scripts/enrich-places-gemini.mjs',
    '--limit', limitArg
  ];
  
  if (dryRun) {
    runArgs.push('--dry-run');
  }

  const result = spawnSync('node', runArgs, { stdio: 'inherit' });

  if (result.status !== 0) {
    console.error(`\n🚨 [LOOP ABORTED] Child process exited with non-zero code: ${result.status}. Stopping loop.`);
    process.exit(result.status || 1);
  }

  scannedTotal += 1000; // 1회 스캔 시 1000건을 스캔함

  const nextLastId = fs.readFileSync(cursorFile, 'utf8').trim();
  if (nextLastId === '') {
    console.log(`\n🎉 === Table scan complete! End of master_places table reached for description enrichment. ===`);
    break;
  }

  // 드라이런 모드라도 대상 데이터를 찾을 때까지 계속 돌도록 하되, 
  // 자식 프로세스에서 limit에 도달하여 수동으로 성공 건수가 발생했다면 루프를 멈춥니다.
  // 성공 건수를 파악하기 위해 로그 상에서 제어가 되거나, 일단 3회 청크 스캔 후 멈추게 조절할 수 있습니다.
  // 여기서는 안전을 위해 1회 성공적인 처리가 있으면 멈추거나, 혹은 계속 스캔하도록 둡니다.
  // 드라이런에서 10,000건 이상 스캔 시 무한루프 방지를 위해 safety guard 추가
  if (scannedTotal >= 50000) {
    console.log(`\n💡 Safety Guard: Scanned 50,000 rows. Stopping loop.`);
    break;
  }

  // 1초 쉬고 다음 배치 수행
  spawnSync('node', ['-e', 'new Promise(r => setTimeout(r, 1000))']);
}

console.log(`\n🎉 === All loop batches completed! Total scanned: ${scannedTotal} ===`);
