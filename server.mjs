import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT) || 4173;
const types = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg', '.png': 'image/png', '.json': 'application/json' };

createServer(async (req, res) => {
  try {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    const candidate = path.resolve(root, '.' + pathname);
    if (candidate !== root && !candidate.startsWith(root + path.sep)) {
      res.writeHead(403).end('Forbidden');
      return;
    }
    const filename = (await stat(candidate).catch(() => null))?.isDirectory() ? path.join(candidate, 'index.html') : candidate;
    const body = await readFile(filename);
    res.writeHead(200, { 'Content-Type': `${types[path.extname(filename)] || 'application/octet-stream'}; charset=utf-8`, 'Cache-Control': 'no-store' }).end(body);
  } catch {
    res.writeHead(404).end('Not Found');
  }
}).listen(port, '0.0.0.0', () => console.log(`RICE ATLAS ready at http://localhost:${port}`));
