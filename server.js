require('dotenv').config();
const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const SHORTS_PATH = process.env.SHORTS_PATH ? path.resolve(process.env.SHORTS_PATH) : null;

if (!SHORTS_PATH) {
  console.error('Error: SHORTS_PATH must be set in .env');
  process.exit(1);
}

if (!fs.existsSync(SHORTS_PATH)) {
  console.error(`Error: SHORTS_PATH does not exist: ${SHORTS_PATH}`);
  process.exit(1);
}

const VIDEO_EXTENSIONS = new Set(['.mp4', '.mov', '.avi', '.mkv', '.wmv', '.flv', '.webm', '.m4v', '.mpeg', '.mpg']);

const MIME_TYPES = {
  '.mp4': 'video/mp4',
  '.mov': 'video/quicktime',
  '.avi': 'video/x-msvideo',
  '.mkv': 'video/x-matroska',
  '.wmv': 'video/x-ms-wmv',
  '.flv': 'video/x-flv',
  '.webm': 'video/webm',
  '.m4v': 'video/x-m4v',
  '.mpeg': 'video/mpeg',
  '.mpg': 'video/mpeg',
};

app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/videos', (req, res) => {
  const files = fs.readdirSync(SHORTS_PATH)
    .filter(f => VIDEO_EXTENSIONS.has(path.extname(f).toLowerCase()))
    .map(f => {
      const { size } = fs.statSync(path.join(SHORTS_PATH, f));
      return { name: f, size };
    });
  res.json(files);
});

app.get('/videos/:filename', (req, res) => {
  const filename = path.basename(req.params.filename);
  const filePath = path.join(SHORTS_PATH, filename);

  if (!fs.existsSync(filePath)) return res.status(404).send('Not found');

  const ext = path.extname(filename).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'video/mp4';
  const { size: fileSize } = fs.statSync(filePath);
  const range = req.headers.range;

  if (range) {
    const [startStr, endStr] = range.replace(/bytes=/, '').split('-');
    const start = parseInt(startStr, 10);
    const end = endStr ? parseInt(endStr, 10) : fileSize - 1;
    res.writeHead(206, {
      'Content-Range': `bytes ${start}-${end}/${fileSize}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': end - start + 1,
      'Content-Type': contentType,
    });
    fs.createReadStream(filePath, { start, end }).pipe(res);
  } else {
    res.writeHead(200, {
      'Content-Length': fileSize,
      'Content-Type': contentType,
      'Accept-Ranges': 'bytes',
    });
    fs.createReadStream(filePath).pipe(res);
  }
});

app.listen(PORT, () => {
  console.log(`Video Shorts running at http://localhost:${PORT}`);
});
