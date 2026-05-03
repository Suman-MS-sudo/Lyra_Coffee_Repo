// Minimal HTTP server that 301s every request to https://<host><url>
// Used so port 80 still answers and forwards visitors to TLS.
const http = require('http');

const PORT = parseInt(process.env.PORT || '80', 10);
const HOST = process.env.HOST || '0.0.0.0';

http.createServer((req, res) => {
  const host = (req.headers.host || '').split(':')[0] || 'localhost';
  res.writeHead(301, { Location: `https://${host}${req.url}` });
  res.end();
}).listen(PORT, HOST, () => {
  console.log(`[redirect] HTTP on ${HOST}:${PORT} → HTTPS`);
});
