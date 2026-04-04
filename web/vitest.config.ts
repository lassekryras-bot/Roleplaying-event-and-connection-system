import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const repoRoot = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const coverageThresholds = JSON.parse(
  fs.readFileSync(path.join(repoRoot, 'coverage-thresholds.json'), 'utf8'),
).frontend;

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text-summary', 'json-summary', 'lcov'],
      reportsDirectory: '../artifacts/frontend/coverage',
      thresholds: {
        ...coverageThresholds.global,
        ...coverageThresholds.keyFiles,
      },
    },
  },
});
