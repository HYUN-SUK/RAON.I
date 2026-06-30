import fs from 'fs';
import readline from 'readline';

async function main() {
  console.log("=== 📊 task-302 로그 분석 및 프롬프트 평균 글자 수 산정 ===");

  const fileStream = fs.createReadStream('C:\\Users\\USER\\.gemini\\antigravity\\brain\\1ed92840-d8a3-4c57-8cf6-3ff9ea8acd3a\\.system_generated\\tasks\\task-302.log');
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  let promptLines = [];
  let successCount = 0;

  for await (const line of rl) {
    if (line.includes('[SUCCESS]')) {
      successCount++;
    }
    // 프롬프트 로그가 남았는지 확인 (단, task-302에서는 SUCCESS 출력문만 주로 남고 Prompt 상세는 안 남았을 수 있음)
    // 만약 프롬프트 형태가 남았다면 파싱
    if (line.includes('Prompt:')) {
      const idx = line.indexOf('Prompt:');
      promptLines.push(line.substring(idx + 7));
    }
  }

  console.log(`- 로그 상 감지된 SUCCESS 호출 건수: ${successCount} 건`);
  console.log(`- 로그 상 감지된 Prompt 출력 건수: ${promptLines.length} 건`);

  if (promptLines.length > 0) {
    let totalLength = 0;
    promptLines.forEach(p => totalLength += p.length);
    const avgLen = totalLength / promptLines.length;
    console.log(`- 프롬프트 평균 글자 수: ${avgLen.toFixed(1)} 자`);
    console.log(`- 프롬프트 평균 예상 토큰 수 (한글 1자=1.5~2토큰): ${(avgLen * 1.8).toFixed(0)} 토큰`);
  } else {
    console.log("⚠️ 로그에 상세 Prompt 문자열이 남지 않았습니다. DB 데이터를 통해 시뮬레이션하겠습니다.");
  }
}

main();
