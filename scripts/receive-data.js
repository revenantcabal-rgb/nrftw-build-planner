const http = require('http');
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'public', 'data');

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  if (req.method === 'POST' && req.url.startsWith('/save/')) {
    const filename = req.url.replace('/save/', '') + '.json';
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      const filepath = path.join(DATA_DIR, filename);
      fs.writeFileSync(filepath, body);
      console.log(`Saved ${filename} (${(body.length/1024).toFixed(1)} KB)`);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, file: filename, size: body.length }));
    });
    return;
  }

  res.writeHead(404);
  res.end('Not found');
});

server.listen(9876, () => {
  console.log('Data receiver listening on http://localhost:9876');
  console.log('Saving to:', DATA_DIR);
});
