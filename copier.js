require('dotenv').config();
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const readline = require('readline');

const VIDEO_EXTENSIONS = new Set(['.mp4', '.mov', '.avi', '.mkv', '.wmv', '.flv', '.webm', '.m4v', '.mpeg', '.mpg']);
const RENAMED_PATTERN = /^\d{4}-\d{2}-\d{2}-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const ORIGIN_PATH      = process.env.ORIGIN_PATH      ? path.resolve(process.env.ORIGIN_PATH)      : null;
const DESTINATION_PATH = process.env.DESTINATION_PATH ? path.resolve(process.env.DESTINATION_PATH) : null;
const { MAX_SIZE_MB } = process.env;
const MOVE_FILES = process.argv.includes('--move');
const RENAME_FILES = process.argv.includes('--rename');

if (MOVE_FILES && RENAME_FILES) {
  console.error('Error: --move and --rename cannot be used together.');
  process.exit(1);
}

if (!ORIGIN_PATH || (!DESTINATION_PATH && !RENAME_FILES)) {
  console.error(RENAME_FILES
    ? 'Error: ORIGIN_PATH must be set in .env'
    : 'Error: ORIGIN_PATH and DESTINATION_PATH must be set in .env');
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
      const stat = fs.statSync(fullPath);
      const created = stat.birthtimeMs > 0 ? stat.birthtime : stat.mtime;
      const alreadyRenamed = RENAMED_PATTERN.test(path.basename(file, path.extname(file)));
      return { file, fullPath, size: stat.size, created, alreadyRenamed };
    })
    .filter(Boolean);
}

function formatLocalDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function createRenamedFile(file, created) {
  const date = formatLocalDate(created);
  const uuid = crypto.randomUUID();
  return `${date}-${uuid}${path.extname(file).toLowerCase()}`;
}

async function main() {
  const allVideos = scanVideos(ORIGIN_PATH);

  if (allVideos.length === 0) {
    console.log('No video files found in origin path.');
    return;
  }

  const sizeEligible = allVideos.filter(v => maxBytes === null || v.size <= maxBytes);
  const toSkip = allVideos.length - sizeEligible.length;
  const alreadyNamed = RENAME_FILES ? sizeEligible.filter(v => v.alreadyRenamed) : [];
  const toCopy = RENAME_FILES ? sizeEligible.filter(v => !v.alreadyRenamed) : sizeEligible;
  const totalSize = toCopy.reduce((sum, v) => sum + v.size, 0);

  const action = RENAME_FILES ? 'rename' : (MOVE_FILES ? 'move' : 'copy');
  const Action = RENAME_FILES ? 'Rename' : (MOVE_FILES ? 'Move' : 'Copy');
  const actionProgress = RENAME_FILES ? 'Renaming' : (MOVE_FILES ? 'Moving' : 'Copying');

  console.log(`\n--- Video ${Action} Summary ---`);
  console.log(`  Origin:      ${ORIGIN_PATH}`);
  if (!RENAME_FILES) console.log(`  Destination: ${DESTINATION_PATH}`);
  console.log(`  Mode:        ${RENAME_FILES ? 'Rename in origin (date + UUID)' : (MOVE_FILES ? 'Move (delete from origin after transfer)' : 'Copy (keep originals)')}`);
  if (maxBytes !== null) console.log(`  Max size:    ${formatSize(maxBytes)}`);
  console.log(`  Videos found:      ${allVideos.length}`);
  console.log(`  Will be ${action}d:  ${toCopy.length}`);
  if (toSkip > 0) console.log(`  Skipped (too large): ${toSkip}`);
  if (alreadyNamed.length > 0) console.log(`  Already named correctly: ${alreadyNamed.length}`);
  console.log(`  Total size: ${formatSize(totalSize)}`);
  console.log('----------------------------\n');

  if (toCopy.length === 0) {
    console.log(`Nothing to ${action}.`);
    return;
  }

  const answer = await ask(`Proceed with ${action}? [y/N] `);
  const confirmed = answer.toLowerCase() === 'y';
  if (!confirmed) {
    console.log('Aborted.');
    return;
  }

  if (!RENAME_FILES && !fs.existsSync(DESTINATION_PATH)) {
    fs.mkdirSync(DESTINATION_PATH, { recursive: true });
    console.log(`\nCreated destination folder: ${DESTINATION_PATH}`);
  }

  console.log(`\n${actionProgress} files...`);
  let done = 0;

  for (const { file, fullPath, size, created } of toCopy) {
    const destinationName = RENAME_FILES ? createRenamedFile(file, created) : file;
    const destPath = path.join(DESTINATION_PATH, destinationName);
    drawProgressBar(done, toCopy.length);
    if (RENAME_FILES) {
      fs.renameSync(fullPath, path.join(ORIGIN_PATH, destinationName));
    } else if (MOVE_FILES) {
      try {
        fs.renameSync(fullPath, destPath);
      } catch {
        // cross-drive: fall back to copy + delete
        fs.copyFileSync(fullPath, destPath);
        fs.unlinkSync(fullPath);
      }
    } else {
      fs.copyFileSync(fullPath, destPath);
    }
    done++;
    drawProgressBar(done, toCopy.length);
    process.stdout.write(`  ← ${file} → ${destinationName} (${formatSize(size)})\n`);
  }

  console.log(`\nDone. ${done} file(s) ${action}d.`);
}

main().catch(err => { console.error(err.message); process.exit(1); });
