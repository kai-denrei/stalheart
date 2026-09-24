// safari-probe-server.mjs — measure the rendering surface in REAL Safari
// without WebDriver.
//
// safaridriver needs "Allow Remote Automation", which is GUI- and
// password-gated (`safaridriver --enable` asks for the operator's password and
// the Safari preferences container is TCC-protected), so a Safari-only
// rendering bug has to be measured from inside the page instead. This server
// is a static file server for the repository that ALSO:
//
//   * injects `probe.js` into index.html when the URL carries `probe=1`, so no
//     game source has to know the probe exists, and
//   * accepts `POST /__probe` and prints the measurements it is handed.
//
//   node artifacts/qa/safari-probe-server.mjs --port 18170
//   open -a Safari 'http://localhost:18170/index.html?probe=1&sw=0&acceptance=1&cine=0&world=story&threat=0.35&heart=none&stage=6&phase=expedition&laser=online&gunship=station#td'
//
// It prints `PROBE <name> <json>` lines as the page reports them and exits
// once the page says it is done (or on --timeout seconds).
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const PORT = Number(arg('--port', '18170'));
const ROOT = new URL('../../', import.meta.url).pathname;
const TIMEOUT = Number(arg('--timeout', '300')) * 1000;

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp',
  '.glb': 'model/gltf-binary', '.gltf': 'model/gltf+json', '.bin': 'application/octet-stream',
  '.webmanifest': 'application/manifest+json', '.ogg': 'audio/ogg', '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav', '.ktx2': 'image/ktx2', '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8', '.ico': 'image/x-icon',
};

let done = false;
const timer = setTimeout(() => { console.log('PROBE timeout'); process.exit(1); }, TIMEOUT);

const server = createServer(async (req, res) => {
  const u = new URL(req.url, 'http://x');
  if (req.method === 'POST' && u.pathname === '/__probe') {
    let body = '';
    req.on('data', (c) => { body += c; });
    req.on('end', () => {
      res.writeHead(204, { 'access-control-allow-origin': '*' }).end();
      try {
        const m = JSON.parse(body);
        if (m.name === 'done') { console.log('PROBE done'); done = true; clearTimeout(timer); setTimeout(() => process.exit(0), 200); return; }
        console.log(`PROBE ${m.name} ${JSON.stringify(m.data)}`);
      } catch (e) { console.log(`PROBE parse-error ${e.message} ${body.slice(0, 200)}`); }
    });
    return;
  }
  let p = decodeURIComponent(u.pathname);
  if (p === '/' || p.endsWith('/')) p += 'index.html';
  const file = join(ROOT, normalize(p).replace(/^(\.\.[/\\])+/, ''));
  try {
    let buf = await readFile(file);
    const type = TYPES[extname(file).toLowerCase()] ?? 'application/octet-stream';
    if (extname(file) === '.html' && u.searchParams.get('probe') === '1') {
      buf = Buffer.from(String(buf).replace('</body>', '<script type="module" src="/artifacts/qa/probe.js"></script></body>'));
    }
    res.writeHead(200, { 'content-type': type, 'cache-control': 'no-store' }).end(buf);
  } catch {
    res.writeHead(404, { 'content-type': 'text/plain' }).end('not found');
  }
});
server.listen(PORT, () => console.log(`probe server on http://localhost:${PORT}/ (root ${ROOT}); done=${done}`));
