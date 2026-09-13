import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const pidFile = path.join(root, '.server.pid');
const logFile = path.join(root, 'server.log');

const action = process.argv[2];

if (action === 'stop') {
  if (fs.existsSync(pidFile)) {
    const pid = Number(fs.readFileSync(pidFile, 'utf8'));
    try {
      process.kill(pid, 'SIGTERM');
      fs.rmSync(pidFile, { force: true });
      console.log(`Stopped server pid ${pid}`);
    } catch {
      console.log('No running server found');
    }
  } else {
    console.log('No pidfile — nothing to stop');
  }
  process.exit(0);
}

if (action === 'start') {
  if (fs.existsSync(pidFile)) {
    const pid = Number(fs.readFileSync(pidFile, 'utf8'));
    try {
      process.kill(pid, 0);
      console.log(`Server already running (pid ${pid})`);
      process.exit(0);
    } catch {
      fs.rmSync(pidFile, { force: true });
    }
  }
  const child = spawn('node', ['server.js'], {
    cwd: root,
    detached: true,
    stdio: ['ignore', fs.openSync(logFile, 'a'), fs.openSync(logFile, 'a')],
  });
  child.unref();
  fs.writeFileSync(pidFile, String(child.pid));
  console.log(`Started server pid ${child.pid} (log: ${logFile})`);
  process.exit(0);
}

console.log('Usage: node scripts/server.js start|stop');
process.exit(1);