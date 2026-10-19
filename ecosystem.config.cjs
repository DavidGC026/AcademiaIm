/* eslint-disable @typescript-eslint/no-require-imports -- PM2 carga esta configuración CommonJS. */
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const basePath = JSON.parse(readFileSync(join(__dirname, '.next', 'routes-manifest.json'), 'utf8')).basePath;
const campus = {
  '/Academia': { name: 'academia-lms', port: '3005' },
  '/ruadiplo': { name: 'ruadiplo-lms', port: '3006' },
}[basePath];
if (!campus) throw new Error('El build debe corresponder a /Academia o /ruadiplo.');

module.exports = {
  apps: [{
    name: campus.name,
    cwd: __dirname,
    script: 'node_modules/next/dist/bin/next',
    args: ['start', '--hostname', '127.0.0.1', '--port', campus.port],
    interpreter: process.execPath,
    env: { NODE_ENV: 'production', ACADEMIA_SKIP_DB_INIT: '1', DB_AUTO_INIT: '0', NEXT_PUBLIC_BASE_PATH: basePath },
    env_production: { NODE_ENV: 'production', ACADEMIA_SKIP_DB_INIT: '1', DB_AUTO_INIT: '0', NEXT_PUBLIC_BASE_PATH: basePath },
  }],
};
