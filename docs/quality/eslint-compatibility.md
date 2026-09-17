# ESLint 10 compatibility

CI exposed a second real upstream compatibility boundary: eslint-plugin-react 7.37.5 (selected by Next.js 16.3.4) still calls context.getFilename, removed in ESLint 10. The official `@eslint/compat` 2.1.1 implements those removed APIs for ESLint 10 and wraps rules without disabling their checks. Apply `fixupConfigRules` to the combined Next/TypeScript configuration. React version is explicit rather than inferred from each non-React workspace.

References: https://github.com/eslint/rewrite/blob/main/packages/compat/src/fixup-rules.js ; https://github.com/eslint/rewrite/tree/main/packages/compat

Remove this adapter only after upgrading the upstream plugins and rerunning lint plus negative lint fixtures. It is not an authorization or runtime dependency.
