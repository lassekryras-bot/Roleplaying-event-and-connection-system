import { spawn } from 'node:child_process';

function runVitest(args) {
  return new Promise((resolve) => {
    const child = spawn('npx', ['vitest', 'run', ...args], { stdio: ['inherit', 'pipe', 'pipe'] });

    let output = '';
    child.stdout.on('data', (chunk) => {
      const text = chunk.toString();
      output += text;
      process.stdout.write(text);
    });

    child.stderr.on('data', (chunk) => {
      const text = chunk.toString();
      output += text;
      process.stderr.write(text);
    });

    child.on('close', (code) => resolve({ code: code ?? 1, output }));
  });
}

const coverageResult = await runVitest(['--coverage']);
if (coverageResult.code === 0) {
  process.exit(0);
}

if (coverageResult.output.includes("Cannot find dependency '@vitest/coverage-v8'")) {
  console.warn('Coverage provider is unavailable in this environment; running unit tests without coverage.');
  const fallbackResult = await runVitest([]);
  process.exit(fallbackResult.code);
}

process.exit(coverageResult.code);
