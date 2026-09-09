# Dependency review decisions

## 2026-09-09: canonical verification foundation

- Existing pinned application versions remain unchanged (Next.js 16.3.4, React 19.2.8, TypeScript 7.0.2, pnpm 12.3.4).
- ESLint 10.10.0 replaces the initially proposed 9.35.0: ESLint's official version-support policy marks v9 EOL as of 2026-08-06. Next.js 16.3.4's own eslint-config-next manifest accepts ESLint >=9.0.0. Runtime compatibility is tested in CI, not inferred from this peer range.
- unrs-resolver's postinstall script is explicitly DENIED (`allowBuilds: false`). Its optional prebuilt platform packages must work without an install-time fallback download. Unknown future lifecycle scripts still fail installation (`strictDepBuilds: true`).
- Do not disable `strictDepBuilds`, use `dangerouslyAllowAllBuilds`, or approve every transitive dependency merely to make CI green.
- Regenerate the lock in the read-only resolution job; review it and rerun frozen install before merge.

Primary references: https://eslint.org/version-support/ ; https://github.com/vercel/next.js/blob/v16.3.4/packages/eslint-config-next/package.json ; https://pnpm.io/settings/build#allowbuilds
