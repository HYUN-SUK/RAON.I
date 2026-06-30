import fs from 'fs';
import readline from 'readline';

async function main() {
  const fileStream = fs.createReadStream('C:\\Users\\USER\\.gemini\\antigravity\\brain\\233342d3-1172-4b7d-9522-603942b730ad\\.system_generated\\logs\\transcript.jsonl');
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  let matchCount = 0;
  for await (const line of rl) {
    try {
      const obj = JSON.parse(line);
      if (obj.tool_calls) {
        for (const tc of obj.tool_calls) {
          if (tc.name === 'write_to_file' || tc.name === 'replace_file_content') {
            const target = tc.args.TargetFile || '';
            if (target.includes('implementation_plan.md')) {
              const content = tc.args.CodeContent || tc.args.ReplacementContent || '';
              console.log(`Found step ${obj.step_index}! Write/Replace to implementation_plan.md.`);
              fs.writeFileSync(`c:\\Users\\USER\\Desktop\\RAON.I\\scratch\\scratch_plan_${obj.step_index}.txt`, content, 'utf8');
              matchCount++;
            }
          }
        }
      }
    } catch (e) {
      // ignore
    }
  }
  console.log(`Scan completed. Found ${matchCount} matching steps.`);
}

main();
