// PM2 process definition for the Lyra Next.js webapp.
// The app listens on 127.0.0.1:3000 — nginx terminates TLS on :443
// and reverse-proxies traffic here.
//
// Usage:
//   pm2 start ecosystem.config.js
//   pm2 save
//   pm2 startup        // run the printed command once
//
// Reload after a deploy:
//   git pull && cd webapp-next && npm ci && npm run build && pm2 reload lyra-webapp
module.exports = {
  apps: [
    {
      name:        'lyra-webapp',
      cwd:         './webapp-next',
      script:      'node_modules/next/dist/bin/next',
      args:        'start -p 3000 -H 127.0.0.1',
      instances:   1,
      exec_mode:   'fork',
      autorestart: true,
      watch:       false,
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'production',
        PORT:     3000,
      },
      out_file:    './logs/webapp-out.log',
      error_file:  './logs/webapp-err.log',
      merge_logs:  true,
      time:        true,
    },
  ],
};
