import { defineConfig } from 'vitest/config';
export default defineConfig({resolve:{conditions:['mvs-source']},test:{include:['tests/**/*.test.ts'],exclude:['tests/e2e/**'],testTimeout:10000}});
