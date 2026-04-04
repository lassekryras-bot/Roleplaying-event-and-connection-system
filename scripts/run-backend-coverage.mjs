import fs from 'node:fs';
import { spawn } from 'node:child_process';

const thresholds = JSON.parse(fs.readFileSync('coverage-thresholds.json', 'utf8')).backend;

const args = [
  '--test',
  '--experimental-test-coverage',
  `--test-coverage-lines=${thresholds.global.lines}`,
  `--test-coverage-functions=${thresholds.global.functions}`,
  `--test-coverage-branches=${thresholds.global.branches}`,
  '--test-coverage-include=src/**/*.js',
  '--test-coverage-exclude=src/server.js',
  'tests/unit/**/*.test.js',
  'tests/integration/**/*.test.js',
];

const child = spawn('node', args, {
  stdio: ['inherit', 'pipe', 'pipe'],
  env: {
    ...process.env,
    NODE_V8_COVERAGE: process.env.NODE_V8_COVERAGE ?? 'artifacts/backend/v8-coverage',
  },
});

let output = '';
for (const stream of [child.stdout, child.stderr]) {
  stream.on('data', (chunk) => {
    const text = chunk.toString();
    output += text;
    process.stdout.write(text);
  });
}

function extractMetricsFor(patternLabel) {
  const escaped = patternLabel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`#\\s+.*${escaped}\\s+\\|\\s+([\\d.]+)\\s+\\|\\s+([\\d.]+)\\s+\\|\\s+([\\d.]+)`, 'm');
  const match = output.match(pattern);
  if (!match) return null;

  const lines = Number(match[1]);
  const branches = Number(match[2]);
  const functions = Number(match[3]);

  return {
    lines,
    branches,
    functions,
    statements: lines,
  };
}

child.on('close', (code) => {
  if (code !== 0) {
    process.exit(code ?? 1);
  }

  const total = extractMetricsFor('all files');
  if (total) {
    console.log(
      `Backend coverage summary: lines ${total.lines}% | branches ${total.branches}% | functions ${total.functions}%`,
    );
  }

  const failures = [];
  for (const [filePath, fileThresholds] of Object.entries(thresholds.keyFiles)) {
    const baseName = filePath.split('/').pop();
    const metrics = extractMetricsFor(baseName);
    if (!metrics) {
      failures.push(`missing coverage data for ${filePath}`);
      continue;
    }

    for (const metric of ['lines', 'branches', 'functions', 'statements']) {
      if (metrics[metric] < fileThresholds[metric]) {
        failures.push(`${filePath} ${metric}: ${metrics[metric]}% < ${fileThresholds[metric]}%`);
      }
    }
  }

  if (failures.length > 0) {
    console.error('Backend key-file coverage threshold failures:');
    for (const failure of failures) {
      console.error(`- ${failure}`);
    }
    process.exit(1);
  }

  console.log('Backend key-file coverage thresholds passed.');
});
