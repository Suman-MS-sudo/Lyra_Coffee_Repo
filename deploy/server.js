/* eslint-disable @typescript-eslint/no-var-requires */
// Custom Next.js production server that terminates TLS on PORT (default 443).
// Run from the webapp-next/ directory (PM2 sets cwd: './webapp-next').
//
// Required env:
//   TLS_CERT_FILE  - path to fullchain PEM
//   TLS_KEY_FILE   - path to private key PEM
// Optional env:
//   PORT  (default 443)
//   HOST  (default 0.0.0.0)

const fs    = require('fs');
const path  = require('path');
const https = require('https');
const next  = require('next');

const PORT = parseInt(process.env.PORT || '443', 10);
const HOST = process.env.HOST || '0.0.0.0';
const CERT = process.env.TLS_CERT_FILE;
const KEY  = process.env.TLS_KEY_FILE;

if (!CERT || !KEY) {
  console.error('[server] TLS_CERT_FILE and TLS_KEY_FILE must be set.');
  process.exit(1);
}
for (const p of [CERT, KEY]) {
  if (!fs.existsSync(p)) {
    console.error(`[server] Missing cert file: ${p}`);
    process.exit(1);
  }
}

const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev, dir: path.resolve(__dirname, '..', 'webapp-next') });
const handle = app.getRequestHandler();

function loadTls() {
  return {
    cert: fs.readFileSync(CERT),
    key:  fs.readFileSync(KEY),
    minVersion: 'TLSv1.2',
  };
}

app.prepare().then(() => {
  const server = https.createServer(loadTls(), (req, res) => handle(req, res));

  // Hot-reload the cert when certbot renews it (every ~60 days)
  // by SIGHUP'ing the process: `pm2 sendSignal SIGHUP lyra-https`
  process.on('SIGHUP', () => {
    try {
      server.setSecureContext(loadTls());
      console.log('[server] TLS cert reloaded');
    } catch (err) {
      console.error('[server] TLS reload failed:', err);
    }
  });

  server.listen(PORT, HOST, () => {
    console.log(`[server] HTTPS ready on https://${HOST}:${PORT}`);
  });
}).catch(err => {
  console.error('[server] Next.js failed to start:', err);
  process.exit(1);
});
