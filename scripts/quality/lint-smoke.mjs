import assert from 'node:assert/strict';
import { ESLint } from 'eslint';
// Deliberately invalid fixtures prove compatibility wrappers do not disable rules.
const linter = new ESLint({ cwd: process.cwd() });
const [typed] = await linter.lintText('export const known = 1; const unused = 2;\n', { filePath: 'packages/domain/src/__lint_probe__.ts' });
assert(typed.messages.some(m=>m.ruleId==='@typescript-eslint/no-unused-vars'&&m.severity===2), 'TypeScript lint rule did not detect the negative fixture');
const [react] = await linter.lintText("import {useState} from 'react'; export function Broken({enabled}: {enabled: boolean}) {if(enabled){useState(0);} return <div/>;}\n", {filePath:'apps/web/src/app/__lint_probe__.tsx'});
assert(react.messages.some(m=>m.ruleId==='react-hooks/rules-of-hooks'&&m.severity===2), 'React hooks rule did not detect the negative fixture');
console.log('ESLint negative fixtures PASS: TypeScript unused variable and conditional React hook were rejected.');
