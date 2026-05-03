// PM2 process definition for the Lyra Next.js webapp running directly on :443.
//
// Two apps:
//  • lyra-https : serves HTTPS on :443 via a custom Next.js server
//                 (uses TLS_CERT_FILE + TLS_KEY_FILE env vars)
//  • lyra-http  : tiny HTTP→HTTPS redirector on :80
//
// Prereqs (one-time, on the server):
//  1. Issue a cert. Easiest: certbot in standalone mode (stop nginx if running):
//        sudo systemctl stop nginx 2>/dev/null
//        sudo certbot certonly --standalone -d brew.lyra-app.co.in
//  2. Allow node to bind privileged ports without root:
//        sudo setcap 'cap_net_bind_service=+ep' "$(readlink -f "$(which node)")"
//  3. Make sure the user running PM2 can read the cert files. Easiest:
//        sudo chmod 0755 /etc/letsencrypt/live /etc/letsencrypt/archive
//        sudo chmod 0644 /etc/letsencrypt/live/brew.lyra-app.co.in/*.pem
//
// Usage:
//   pm2 start ecosystem.config.js
//   pm2 save
//   pm2 startup        // run the printed sudo command once
//
// Reload after a deploy:
//   git pull && cd webapp-next && npm ci && npm run build && pm2 reload all
module.exports = {
  apps: [
    {
      name:        'lyra-https',
      cwd:         './webapp-next',
      script:      '../deploy/server.js',
      instances:   1,
      exec_mode:   'fork',
      autorestart: true,
      watch:       false,
      max_memory_restart: '512M',
      env: {
        NODE_ENV:      'production',
        PORT:          443,
        HOST:          '0.0.0.0',
        TLS_CERT_FILE: '/etc/letsencrypt/live/brew.lyra-app.co.in/fullchain.pem',
        TLS_KEY_FILE:  '/etc/letsencrypt/live/brew.lyra-app.co.in/privkey.pem',
      },
      out_file:    './logs/https-out.log',
      error_file:  './logs/https-err.log',
      merge_logs:  true,
      time:        true,
    },
    {
      name:        'lyra-http',
      cwd:         '.',
      script:      './deploy/redirect.js',
      instances:   1,
      exec_mode:   'fork',
      autorestart: true,
      watch:       false,
      max_memory_restart: '128M',
      env: {
        NODE_ENV: 'production',
        PORT:     80,
        HOST:     '0.0.0.0',
      },
      out_file:    './logs/http-out.log',
      error_file:  './logs/http-err.log',
      merge_logs:  true,
      time:        true,
    },
  ],
};
