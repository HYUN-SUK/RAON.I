const { execSync } = require('child_process');
const fs = require('fs');

try {
    const output = execSync('git log -n 10 --date=iso --pretty=format:"%h - %cd - %s" ', { encoding: 'utf8' });
    fs.writeFileSync('git_commits.txt', output, 'utf8');
} catch (e) {
    console.error(e.message);
}
