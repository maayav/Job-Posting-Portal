import { copyFile, access } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const target = fileURLToPath(new URL('../backend/.env', import.meta.url));
try { await access(target); console.log('backend/.env already exists; preserved.'); }
catch { await copyFile(new URL('../backend/.env.example', import.meta.url), target); console.log('Created backend/.env. Fill in provider keys and JWT_SECRET before starting.'); }
