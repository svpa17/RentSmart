// RĂSCRUCE AI — server local pentru funcțiile din api/ (alternativă la `vercel dev`, fără cont).
// Rulare: npm run api   (citește api/.env dacă există; port implicit 3000, sau API_PORT)
import { createServer } from 'node:http';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const envFile = path.join(root, 'api', '.env');
if (existsSync(envFile)) process.loadEnvFile(envFile);

const routes = {
  '/api/analyze': await import('../api/analyze.js'),
  '/api/health': await import('../api/health.js'),
  '/api/alternatives': await import('../api/alternatives.js'),
};

const port = Number(process.env.API_PORT || 3000);

createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${port}`);
  const mod = routes[url.pathname];
  const handler = mod?.[req.method];
  if (!handler) {
    res.writeHead(mod ? 405 : 404).end();
    return;
  }
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const headers = new Headers();
  for (const [k, v] of Object.entries(req.headers)) if (typeof v === 'string') headers.set(k, v);
  headers.set('x-real-ip', req.socket.remoteAddress ?? 'local');
  const request = new Request(url, {
    method: req.method,
    headers,
    body: ['GET', 'HEAD'].includes(req.method) ? undefined : Buffer.concat(chunks),
  });
  const response = await handler(request);
  res.writeHead(response.status, Object.fromEntries(response.headers));
  res.end(Buffer.from(await response.arrayBuffer()));
}).listen(port, () => console.log(`API locală: http://localhost:${port}/api/health`));
