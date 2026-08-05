import { spawn } from 'child_process';
import path from 'path';

// KST 8월 5일 기준 타겟 시도 자동 계산
const SIDO_ROTATION = [
  '서울특별시', '부산광역시', '대구광역시', '인천광역시', 
  '전남광주시',
  '대전광역시', '울산광역시', '세종특별자치시', '경기도', 
  '강원특별자치도', '충청북도', '충청남도', '전북특별자치도', '경상북도', '경상남도', '제주특별자치도'
];

const now = new Date();
const kstNow = new Date(now.getTime() + 9 * 60 * 60 * 1000);
const year = kstNow.getUTCFullYear();
const startOfYearKstMs = Date.UTC(year, 0, 1);
const diff = kstNow.getTime() - startOfYearKstMs;
const dayOfYear = Math.floor(diff / (1000 * 60 * 60 * 24)) + 1;
const targetIndex = (dayOfYear - 1) % SIDO_ROTATION.length;
const targetSido = SIDO_ROTATION[targetIndex];

console.log(`[Manual Trigger] KST Today: ${kstNow.toISOString().slice(0, 10)} | Day of Year: ${dayOfYear}`);
console.log(`[Manual Trigger] Calculated target Sido: "${targetSido}"`);

const scriptPath = path.resolve('scripts/daily-region-sync.mjs');
console.log(`[Manual Trigger] Executing: node ${scriptPath} "${targetSido}"`);

const child = spawn('node', [scriptPath, targetSido], { stdio: 'inherit' });

child.on('close', (code) => {
  console.log(`[Manual Trigger] Process finished with exit code: ${code}`);
  process.exit(code);
});
