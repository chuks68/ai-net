import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 3000;

const MIME_TYPES = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
};

const server = http.createServer((req, res) => {
  // Normalize the URL path
  let filePath = req.url.split('?')[0];

  // API mocks directly in the server
  if (filePath === '/api/agents') {
    res.writeHead(200, { 
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*' 
    });
    res.end(JSON.stringify([
      {
        id: 'agent-1',
        name: 'Research Specialist',
        capabilities: ['research', 'report'],
        price: 0.5,
        reputation: 4.8,
        status: 'active',
      },
      {
        id: 'agent-2',
        name: 'Smart Contract Dev',
        capabilities: ['coding'],
        price: 1.2,
        reputation: 4.9,
        status: 'active',
      },
      {
        id: 'agent-3',
        name: 'QA Audit Agent',
        capabilities: ['coding', 'audit'],
        price: 0.8,
        reputation: 4.2,
        status: 'inactive',
      },
    ]));
    return;
  }

  if (filePath === '/api/tasks' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });
    req.on('end', () => {
      res.writeHead(200, { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*' 
      });
      res.end(JSON.stringify({
        taskId: 'mock-task-e2e-123',
        status: 'pending',
      }));
    });
    return;
  }

  // Serve local Stellar SDK bundle
  if (filePath === '/stellar-sdk.js') {
    const sdkPath = path.join(__dirname, 'node_modules', '@stellar/stellar-sdk', 'dist', 'stellar-sdk.js');
    res.writeHead(200, { 'Content-Type': 'application/javascript' });
    fs.createReadStream(sdkPath).pipe(res);
    return;
  }

  // Map request to public directory or fallback to index.html for SPA routing
  let ext = path.extname(filePath);
  let resolvedPath = path.join(__dirname, 'public', filePath);

  if (!ext) {
    // Single Page Application routing fallback: serve index.html
    resolvedPath = path.join(__dirname, 'public', 'index.html');
    ext = '.html';
  }

  fs.stat(resolvedPath, (err, stats) => {
    if (err || !stats.isFile()) {
      // Fallback to index.html for SPA
      resolvedPath = path.join(__dirname, 'public', 'index.html');
      ext = '.html';
    }

    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': contentType });
    fs.createReadStream(resolvedPath).pipe(res);
  });
});

server.listen(PORT, () => {
  console.log(`Server is running at http://localhost:${PORT}`);
});
