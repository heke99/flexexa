import { defineConfig, globalIgnores } from 'eslint/config';
import { fixupConfigRules } from '@eslint/compat';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTypescript from 'eslint-config-next/typescript';
// Use ESLint's official compatibility bridge; keep the underlying rules active.
export default defineConfig([
  ...fixupConfigRules([...nextVitals, ...nextTypescript]),
  {
    settings: { react: { version: '19.2.8' }, next: { rootDir: 'apps/web/' } },
    // Next defaults these to warnings. Flexexa treats them as CI failures.
    rules: {
      '@typescript-eslint/no-unused-vars': 'error',
      '@typescript-eslint/no-unused-expressions': 'error',
    },
  },
  globalIgnores(['**/node_modules/**','**/.next/**','**/.turbo/**','.flexexa/index/**','**/next-env.d.ts']),
]);
