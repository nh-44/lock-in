const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = process.env.PORT || 3000;

const handlers = {
  '/api/user': './api/user',
  '/api/workouts': './api/workouts',
  '/api/stats': './api/stats',
  '/api/inbody': './api/inbody',
};

const server = http.createServer((req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (pathname.startsWith('/api/')) {
    const handlerPath = handlers[pathname];
    if (!handlerPath) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: `No handler for ${pathname}` }));
      return;
    }

    let handler;
    try {
      handler = require(handlerPath);
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Handler load failed', details: e.message }));
      return;
    }

    // Wrap res with Express-like methods
    res.status = function (code) { res.statusCode = code; return res; };
    res.json = function (obj) {
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify(obj));
    };

    req.query = parsedUrl.query;

    // Parse body for all methods (handlers may read req.body for auth fallback)
    let body = '';
    req.on('data', chunk => (body += chunk));
    req.on('end', () => {
      try {
        req.body = body ? JSON.parse(body) : {};
      } catch {
        req.body = {};
      }
      handler(req, res);
    });
    return;
  }

  // Serve static files from /public
  let filePath = path.join(__dirname, 'public', pathname === '/' ? 'index.html' : pathname.replace(/^\//, ''));
  const ext = path.extname(filePath);
  const mimes = {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
  };

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Not found');
      return;
    }
    const contentType = mimes[ext] || 'application/octet-stream';
    const charset = ext === '.html' || ext === '.js' || ext === '.css' ? '; charset=utf-8' : '';
    res.writeHead(200, { 'Content-Type': contentType + charset });
    res.end(data);
  });
});

server.listen(PORT, () => {
  console.log(`\n  Lock-In test server running at http://localhost:${PORT}\n`);
  if (!process.env.POSTGRES_URL) {
    console.log('  ⚠  POSTGRES_URL env var is NOT set. API calls will fail.');
    console.log('  →  Export it: export POSTGRES_URL="postgresql://..."\n');
  }
  if (!process.env.GOOGLE_CLIENT_ID) {
    console.log('  ⚠  GOOGLE_CLIENT_ID env var is NOT set. Google Sign-In will use a fallback.');
    console.log('  →  Export it: export GOOGLE_CLIENT_ID="your-client-id"\n');
  }
});
