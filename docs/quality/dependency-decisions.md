# Dependency review decisions

## 2026-09-09: canonical verification foundation

- Application versions remain Next.js 16.3.4, React 19.2.8, native TypeScript compiler 7.0.2 and pnpm 12.3.4.
- Actual CI showed typescript-eslint cannot consume the TS 7.0 compiler API (TS7 does not ship that API). Adopt Microsoft's documented side-by-side aliases: `@typescript/native: npm:typescript@7.0.2` supplies `tsc`; `typescript: npm:@typescript/typescript6@6.0.2` supplies the compatible API and `tsc6`. Keep these exact versions consistent across workspaces. Do not suppress parser failures or disable TypeScript linting.
- ESLint 10.10.0 replaces the initially proposed 9.35.0: the official version-support policy marks v9 EOL as of 2026-08-06. Next.js 16.3.4's own eslint-config-next manifest accepts ESLint >=9.0.0. Runtime compatibility must pass CI, not just peer-range checks.
- unrs-resolver's postinstall is explicitly DENIED (`allowBuilds: false`). Its optional prebuilt platform packages must work without a fallback download script. Unknown future lifecycle scripts still fail installation (`strictDepBuilds: true`). CI confirmed install succeeds with that denial.
- Never disable `strictDepBuilds` or enable `dangerouslyAllowAllBuilds` to make installation green.
- Regenerate the lock in the read-only resolution job; review it and rerun frozen install before merge.

Primary references: https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/#running-side-by-side-with-typescript-6.0 ; https://eslint.org/version-support/ ; https://github.com/vercel/next.js/blob/v16.3.4/packages/eslint-config-next/package.json ; https://pnpm.io/settings/build#allowbuilds
