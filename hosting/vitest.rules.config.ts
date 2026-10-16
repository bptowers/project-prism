import { defineConfig } from 'vitest/config';

// Security-rules tests run in Node against the Firestore emulator, separately
// from the jsdom component suite (which must not need an emulator).
export default defineConfig({
  test: {
    environment: 'node',
    include: ['rules-tests/**/*.test.ts'],
    testTimeout: 20_000,
    hookTimeout: 30_000,
  },
});
