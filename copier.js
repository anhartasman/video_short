require('dotenv').config();
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const VIDEO_EXTENSIONS = new Set(['.mp4', '.mov', '.avi', '.mkv', '.wmv', '.flv', '.webm', '.m4v', '.mpeg', '.mpg']);

const ORIGIN_PATH      = process.env.ORIGIN_PATH      ? path.resolve(process.env.ORIGIN_PATH)      : null;
const DESTINATION_PATH = process.env.DESTINATION_PATH ? path.resolve(process.env.DESTINATION_PATH) : null;
const { MAX_SIZE_MB } = process.env;

if (!ORIGIN_PATH || !DESTINATION_PATH) {
  console.error('Error: ORIGIN_PATH and DESTINATION_PATH must be set in .env');
  process.exit(1);
}

if (!fs.existsSync(ORIGIN_PATH)) {
  console.error(`Error: Origin path does not exist: ${ORIGIN_PATH}`);
  process.exit(1);
}

const maxBytes = MAX_SIZE_MB ? parseFloat(MAX_SIZE_MB) * 1024 * 1024 : null;

function formatSize(bytes) {
  if (bytes >= 1024 ** 3) return (bytes / 1024 ** 3).toFixed(2) + ' GB';
  if (bytes >= 1024 ** 2) return (bytes / 1024 ** 2).toFixed(2) + ' MB';
  return (bytes / 1024).toFixed(2) + ' KB';
}

function drawProgressBar(current, total, barWidth = 30) {
  const pct = total === 0 ? 1 : current / total;
  const filled = Math.round(pct * barWidth);
  const bar = '█'.repeat(filled) + '░'.repeat(barWidth - filled);
  const percent = Math.round(pct * 100);
  process.stdout.write(`\r  [${bar}] ${percent}% (${current}/${total})`);
}

function ask(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => rl.question(question, answer => { rl.close(); resolve(answer.trim()); }));
}

function scanVideos(dir) {
  return fs.readdirSync(dir)
    .map(file => {
      const ext = path.extname(file).toLowerCase();
      if (!VIDEO_EXTENSIONS.has(ext)) return null;
      const fullPath = path.join(dir, file);
      const { size } = fs.statSync(fullPath);
      return { file, fullPath, size };
    })
    .filter(Boolean);
}

async function main() {
  const allVideos = scanVideos(ORIGIN_PATH);

  if (allVideos.length === 0) {
    console.log('No video files found in origin path.');
    return;
  }

  const toCopy = allVideos.filter(v => maxBytes === null || v.size <= maxBytes);
  const toSkip = allVideos.length - toCopy.length;
  const totalSize = toCopy.reduce((sum, v) => sum + v.size, 0);

  console.log('\n--- Video Copy Summary ---');
  console.log(`  Origin:      ${ORIGIN_PATH}`);
  console.log(`  Destination: ${DESTINATION_PATH}`);
  if (maxBytes !== null) console.log(`  Max size:    ${formatSize(maxBytes)}`);
  console.log(`  Videos found:    ${allVideos.length}`);
  console.log(`  Will be copied:  ${toCopy.length}`);
  if (toSkip > 0) console.log(`  Skipped (too large): ${toSkip}`);
  console.log(`  Total copy size: ${formatSize(totalSize)}`);
  console.log('--------------------------\n');

  if (toCopy.length === 0) {
    console.log('Nothing to copy.');
    return;
  }

  const answer = await ask('Proceed with copy? [y/N] ');
  if (answer.toLowerCase() !== 'y') {
    console.log('Aborted.');
    return;
  }

  if (!fs.existsSync(DESTINATION_PATH)) {
    fs.mkdirSync(DESTINATION_PATH, { recursive: true });
    console.log(`\nCreated destination folder: ${DESTINATION_PATH}`);
  }

  console.log('\nCopying files...');
  let copied = 0;

  for (const { file, fullPath, size } of toCopy) {
    const destPath = path.join(DESTINATION_PATH, file);
    drawProgressBar(copied, toCopy.length);
    fs.copyFileSync(fullPath, destPath);
    copied++;
    drawProgressBar(copied, toCopy.length);
    process.stdout.write(`  ← ${file} (${formatSize(size)})\n`);
  }

  console.log(`\nDone. ${copied} file(s) copied.`);
}

main().catch(err => { console.error(err.message); process.exit(1); });
