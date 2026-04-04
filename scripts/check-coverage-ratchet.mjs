import { execSync } from 'node:child_process';

const thresholdsFile = 'coverage-thresholds.json';
const approvalFlag = process.env.COVERAGE_THRESHOLD_REDUCTION_APPROVED === 'true';
const baseRef = process.env.GITHUB_BASE_REF ? `origin/${process.env.GITHUB_BASE_REF}` : null;

function flattenThresholds(obj, prefix = '', out = {}) {
  for (const [key, value] of Object.entries(obj)) {
    const next = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'number') {
      out[next] = value;
    } else if (value && typeof value === 'object') {
      flattenThresholds(value, next, out);
    }
  }
  return out;
}

let previous = null;

try {
  if (baseRef) {
    execSync(`git fetch origin ${process.env.GITHUB_BASE_REF} --depth=1`, { stdio: 'ignore' });
    previous = JSON.parse(execSync(`git show ${baseRef}:${thresholdsFile}`, { encoding: 'utf8' }));
  } else {
    previous = JSON.parse(execSync(`git show HEAD~1:${thresholdsFile}`, { encoding: 'utf8' }));
  }
} catch {
  console.log('Ratchet check skipped: no previous threshold baseline found.');
  process.exit(0);
}

const current = JSON.parse(execSync(`cat ${thresholdsFile}`, { encoding: 'utf8' }));

const oldFlat = flattenThresholds(previous);
const currentFlat = flattenThresholds(current);

const lowered = [];
for (const [key, oldValue] of Object.entries(oldFlat)) {
  if (!(key in currentFlat)) {
    lowered.push(`${key} removed (previously ${oldValue})`);
    continue;
  }

  const newValue = currentFlat[key];
  if (newValue < oldValue) {
    lowered.push(`${key}: ${oldValue} -> ${newValue}`);
  }
}

if (lowered.length > 0 && !approvalFlag) {
  console.error('Coverage ratchet failure: thresholds cannot be lowered without explicit approval.');
  console.error('Set COVERAGE_THRESHOLD_REDUCTION_APPROVED=true for an approved reduction.');
  for (const item of lowered) {
    console.error(`- ${item}`);
  }
  process.exit(1);
}

if (lowered.length > 0) {
  console.warn('Coverage thresholds were lowered with explicit approval:');
  for (const item of lowered) {
    console.warn(`- ${item}`);
  }
} else {
  console.log('Coverage ratchet check passed: thresholds stayed the same or increased.');
}
