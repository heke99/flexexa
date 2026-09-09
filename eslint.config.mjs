import { defineConfig, globalIgnores } from 'eslint/config';
import { fixupConfigRules } from '@eslint/compat';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTypescript from 'eslint-config-next/typescript';
// Next's React plugin still uses removed context methods. Use ESLint's
// official compatibility layer; never disable those rules to hide the crash.
export default defineConfig([
  ...fixupConfigRules([...nextVitals, ...nextTypescript]),
  { settings: { react: { version: '19.2.8' }, next: { rootDir: 'apps/web/' } } },
  globalIgnores(['**/node_modules/**','**/.next/**','**/.turbo/**','.flexexa/index/**','**/next-env.d.ts']),
]);
