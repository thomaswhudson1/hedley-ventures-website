// Local stand-in for the Resend API, used only when testing on this computer.
// Saves each "sent" email to test/outbox/*.json. Create test/outbox/FAIL to simulate Resend being down.
import { createServer } from 'node:http';
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const outbox = join(dirname(fileURLToPath(import.meta.url)), 'outbox');
mkdirSync(outbox, { recursive: true });
let n = 0;

createServer((req, res) => {
  let body = '';
  req.on('data', (c) => { body += c; });
  req.on('end', () => {
    if (existsSync(join(outbox, 'FAIL'))) {
      res.writeHead(503, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ name: 'service_unavailable', message: 'Simulated outage' }));
    }
    const id = `mock-${Date.now()}-${++n}`;
    writeFileSync(join(outbox, `${id}.json`), JSON.stringify({ auth: req.headers.authorization ? 'present' : 'missing', ...JSON.parse(body || '{}') }, null, 2));
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ id }));
  });
}).listen(8790, () => console.log('Mock Resend listening on http://localhost:8790'));
