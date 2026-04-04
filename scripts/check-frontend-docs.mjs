import { readFileSync } from 'node:fs';

const requiredPatterns = [
  'npm --prefix web run dev',
  'npm --prefix web run build'
];

const forbiddenPatterns = [
  'archive/root-next-app',
  'web/src/main.tsx',
  'npm run dev'
];

const canonicalDocs = ['README.md'];

const failures = [];

for (const docPath of canonicalDocs) {
  const content = readFileSync(docPath, 'utf8');

  for (const pattern of requiredPatterns) {
    if (!content.includes(pattern)) {
      failures.push(`${docPath}: missing required canonical command \"${pattern}\"`);
    }
  }

  for (const pattern of forbiddenPatterns) {
    if (content.includes(pattern)) {
      failures.push(`${docPath}: contains forbidden archived/non-canonical reference \"${pattern}\"`);
    }
  }
}

if (failures.length > 0) {
  console.error('Frontend docs check failed:');
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log('Frontend docs check passed. Canonical docs mention --prefix web and avoid archived paths.');
