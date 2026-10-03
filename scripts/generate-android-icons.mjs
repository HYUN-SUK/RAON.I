import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const SOURCE_ICON = path.resolve('public/icons/icon-512.png');
const RES_DIR = path.resolve('android/app/src/main/res');

const DENSITIES = [
  { dir: 'mipmap-mdpi', size: 48, fgSize: 108 },
  { dir: 'mipmap-hdpi', size: 72, fgSize: 162 },
  { dir: 'mipmap-xhdpi', size: 96, fgSize: 216 },
  { dir: 'mipmap-xxhdpi', size: 144, fgSize: 324 },
  { dir: 'mipmap-xxxhdpi', size: 192, fgSize: 432 },
];

async function generateIcons() {
  console.log('Generating Android App Icons from:', SOURCE_ICON);

  for (const { dir, size, fgSize } of DENSITIES) {
    const targetDir = path.join(RES_DIR, dir);
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    // 1. ic_launcher.png (기본 런처 아이콘 - 흰색 배경 + 라온아이 로고)
    await sharp(SOURCE_ICON)
      .resize(size, size, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 1 } })
      .flatten({ background: '#FFFFFF' })
      .png()
      .toFile(path.join(targetDir, 'ic_launcher.png'));

    // 2. ic_launcher_round.png (원형 런처 아이콘 - 원형 마스크)
    const circleSvg = Buffer.from(
      `<svg width="${size}" height="${size}"><circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}" fill="#FFFFFF"/></svg>`
    );
    await sharp(SOURCE_ICON)
      .resize(size, size, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 1 } })
      .flatten({ background: '#FFFFFF' })
      .composite([{ input: circleSvg, blend: 'dest-in' }])
      .png()
      .toFile(path.join(targetDir, 'ic_launcher_round.png'));

    // 3. ic_launcher_foreground.png (Adaptive Icon 전경 - 안드로이드 One UI 알림창 좌측 원형 로고의 핵심!)
    // 중앙 70% 크기로 배치하여 시스템이 원형 크롭해도 글자나 나무가 잘리지 않도록 안전 여백 적용
    const innerSize = Math.round(fgSize * 0.70);
    const innerPadding = Math.round((fgSize - innerSize) / 2);

    const resizedLogo = await sharp(SOURCE_ICON)
      .resize(innerSize, innerSize, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 0 } })
      .toBuffer();

    await sharp({
      create: {
        width: fgSize,
        height: fgSize,
        channels: 4,
        background: { r: 255, g: 255, b: 255, alpha: 0 }
      }
    })
      .composite([{ input: resizedLogo, top: innerPadding, left: innerPadding }])
      .png()
      .toFile(path.join(targetDir, 'ic_launcher_foreground.png'));

    console.log(`[OK] ${dir}: ic_launcher (${size}px), foreground (${fgSize}px)`);
  }

  console.log('All Android icons generated successfully!');
}

generateIcons().catch(err => {
  console.error('Failed to generate icons:', err);
  process.exit(1);
});
