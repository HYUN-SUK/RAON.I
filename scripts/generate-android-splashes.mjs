import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const SOURCE_ICON = path.resolve('public/icons/icon-512.png');
const RES_DIR = path.resolve('android/app/src/main/res');

const SPLASH_SIZES = [
  { dir: 'drawable', width: 480, height: 800, logoSize: 200 },
  { dir: 'drawable-port-mdpi', width: 320, height: 480, logoSize: 160 },
  { dir: 'drawable-port-hdpi', width: 480, height: 800, logoSize: 220 },
  { dir: 'drawable-port-xhdpi', width: 720, height: 1280, logoSize: 320 },
  { dir: 'drawable-port-xxhdpi', width: 960, height: 1600, logoSize: 420 },
  { dir: 'drawable-port-xxxhdpi', width: 1280, height: 1920, logoSize: 512 },
  { dir: 'drawable-land-mdpi', width: 480, height: 320, logoSize: 160 },
  { dir: 'drawable-land-hdpi', width: 800, height: 480, logoSize: 220 },
  { dir: 'drawable-land-xhdpi', width: 1280, height: 720, logoSize: 320 },
  { dir: 'drawable-land-xxhdpi', width: 1600, height: 960, logoSize: 420 },
  { dir: 'drawable-land-xxxhdpi', width: 1920, height: 1280, logoSize: 512 },
];

async function generateSplashes() {
  console.log('Generating Splash Screens with Raon.I logo...');

  for (const { dir, width, height, logoSize } of SPLASH_SIZES) {
    const targetDir = path.join(RES_DIR, dir);
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    const actualLogoSize = Math.min(logoSize, width * 0.5, height * 0.5);
    const resizedLogo = await sharp(SOURCE_ICON)
      .resize(Math.round(actualLogoSize), Math.round(actualLogoSize), { fit: 'contain' })
      .toBuffer();

    const top = Math.round((height - actualLogoSize) / 2);
    const left = Math.round((width - actualLogoSize) / 2);

    await sharp({
      create: {
        width,
        height,
        channels: 4,
        background: { r: 255, g: 255, b: 255, alpha: 1 }
      }
    })
      .composite([{ input: resizedLogo, top, left }])
      .png()
      .toFile(path.join(targetDir, 'splash.png'));

    console.log(`[OK] Splash generated: ${dir} (${width}x${height})`);
  }
}

generateSplashes().catch(console.error);
