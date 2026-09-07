import { createServer } from 'node:http';
import { readFile, stat, realpath } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
const args = process.argv.slice(2);
const arg = (key, fallback) => args.includes(key) ? args[args.indexOf(key)+1] : fallback;
const root = await realpath(resolve(arg('--dir', '.')));
const port = Number(arg('--port', '8155'));
const base = arg('--base', '/');
if (!base.startsWith('/') || !base.endsWith('/')) throw Error('--base must start and end with /');
const mime = { '.html':'text/html', '.js':'text/javascript', '.mjs':'text/javascript', '.css':'text/css', '.json':'application/json', '.webmanifest':'application/manifest+json', '.glb':'model/gltf-binary', '.wasm':'application/wasm', '.svg':'image/svg+xml', '.png':'image/png', '.mp3':'audio/mpeg', '.wav':'audio/wav', '.woff2':'font/woff2', '.md':'text/plain' };
const server = createServer(async (req,res) => {
  try {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    if (!pathname.startsWith(base)) { res.writeHead(404).end(); return; }
    const route = pathname.slice(base.length);
    if (route.split('/').some(p => p.startsWith('.')) || /^(node_modules|docs|test|scripts|artifacts)\//.test(route)) { res.writeHead(404).end(); return; }
    let path = resolve(root, route || 'index.html');
    if ((await stat(path)).isDirectory()) path = resolve(path, 'index.html');
    path = await realpath(path);
    if (!path.startsWith(root + sep)) { res.writeHead(403).end(); return; }
    const data = await readFile(path);
    res.writeHead(200, { 'Content-Type': mime[extname(path)] || 'application/octet-stream', 'Cache-Control':'no-store', 'Content-Length':data.length });
    res.end(req.method === 'HEAD' ? undefined : data);
  } catch { res.writeHead(404).end('Not found'); }
});
server.listen(port, '127.0.0.1', () => console.log(`Stalheart: http://127.0.0.1:${port}${base}`));
for (const sig of ['SIGTERM', 'SIGINT']) process.on(sig, () => server.close(() => process.exit(0)));
