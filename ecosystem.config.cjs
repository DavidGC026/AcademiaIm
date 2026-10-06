module.exports = {
  apps: [{
    name: 'academia-lms',
    cwd: __dirname,
    script: 'node_modules/next/dist/bin/next',
    args: ['start', '--hostname', '127.0.0.1', '--port', '3005'],
    interpreter: process.execPath,
    env: { NODE_ENV: 'production', ACADEMIA_SKIP_DB_INIT: '0' },
  }],
};
