import { spawn, execSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const isWin = process.platform === 'win32';

function spawnService(name, command, args, cwd) {
  const child = isWin
    ? spawn('cmd.exe', ['/c', command, ...args], { cwd, stdio: 'inherit' })
    : spawn(command, args, { cwd, stdio: 'inherit' });

  child.on('exit', (code) => {
    if (code !== null && code !== 0) {
      console.error(`[${name}] exited with code ${code}`);
    }
  });

  return child;
}

const serverProc = spawnService(
  'Backend',
  isWin ? 'npm.cmd' : 'npm',
  ['run', 'dev'],
  resolve(rootDir, 'server'),
);

const clientProc = spawnService(
  'Frontend',
  isWin ? 'npx.cmd' : 'npx',
  ['vite', '--host', '127.0.0.1'],
  resolve(rootDir, 'client'),
);

function killTree(child) {
  if (!child.pid) return;
  if (isWin) {
    try {
      execSync(`taskkill /PID ${child.pid} /T /F`, { stdio: 'ignore' });
    } catch {
      // Process already exited
    }
  } else {
    child.kill('SIGTERM');
  }
}

function shutdown() {
  killTree(serverProc);
  killTree(clientProc);
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
