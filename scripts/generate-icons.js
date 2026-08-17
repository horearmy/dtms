const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const sizes = [72, 96, 128, 144, 152, 192, 384, 512];
const outDir = path.join(__dirname, '..', 'public', 'icons');

if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

function createSvg(size) {
  const padding = Math.round(size * 0.15);
  const boxSize = size - padding * 2;
  const fontSize = Math.round(size * 0.32);
  const subFontSize = Math.round(size * 0.13);
  const iconY = Math.round(size * 0.42);
  const textY = Math.round(size * 0.72);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#1e40af"/>
      <stop offset="100%" stop-color="#3b82f6"/>
    </linearGradient>
  </defs>
  <rect width="${size}" height="${size}" rx="${Math.round(size * 0.18)}" fill="url(#bg)"/>
  <g transform="translate(${size/2}, ${iconY})">
    <rect x="${-boxSize*0.22}" y="${-boxSize*0.22}" width="${boxSize*0.44}" height="${boxSize*0.44}" rx="${Math.round(boxSize*0.06)}" fill="none" stroke="white" stroke-width="${Math.max(2, Math.round(size*0.025))}"/>
    <line x1="0" y1="${-boxSize*0.22}" x2="0" y2="${boxSize*0.05}" stroke="white" stroke-width="${Math.max(2, Math.round(size*0.02))}"/>
    <circle cx="0" cy="${boxSize*0.12}" r="${Math.round(boxSize*0.04)}" fill="white"/>
    <polyline points="${-boxSize*0.1},${boxSize*0.04} ${-boxSize*0.04},${boxSize*0.12} ${boxSize*0.04},${boxSize*0.0}" fill="none" stroke="white" stroke-width="${Math.max(1.5, Math.round(size*0.018))}" stroke-linecap="round" stroke-linejoin="round"/>
  </g>
  <text x="${size/2}" y="${textY}" font-family="system-ui,-apple-system,sans-serif" font-size="${fontSize}" font-weight="800" fill="white" text-anchor="middle" letter-spacing="${Math.round(size*0.01)}">DTMS</text>
  <text x="${size/2}" y="${textY + subFontSize * 1.4}" font-family="system-ui,-apple-system,sans-serif" font-size="${subFontSize}" font-weight="500" fill="rgba(255,255,255,0.75)" text-anchor="middle" letter-spacing="${Math.round(size*0.005)}">DRIVER</text>
</svg>`;
}

async function generate() {
  for (const size of sizes) {
    const svg = createSvg(size);
    const outFile = path.join(outDir, `icon-${size}.png`);
    await sharp(Buffer.from(svg)).png().toFile(outFile);
    console.log(`  icon-${size}.png`);
  }
  console.log(`\n${sizes.length} icons generated in ${outDir}`);
}

generate().catch(err => { console.error(err); process.exit(1); });
