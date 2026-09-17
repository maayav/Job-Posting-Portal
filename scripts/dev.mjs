import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const root = new URL('../', import.meta.url);
const children = [
  ['backend', ['--watch', 'server.js']],
  ['frontend', ['node_modules/vite/bin/vite.js']],
].map(([folder, args]) => spawn(process.execPath, args, { cwd: fileURLToPath(new URL(folder, root)), stdio: 'inherit', windowsHide: true }));
let stopping = false;
function stop(code = 0) { if (stopping) return; stopping = true; children.forEach((child) => child.kill()); process.exitCode = code; }
process.on('SIGINT', () => stop());
process.on('SIGTERM', () => stop());
children.forEach((child) => { child.on('error', (error) => { console.error(error.message); stop(1); }); child.on('exit', (code) => stop(code || 0)); });
