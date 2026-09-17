# PR12 clean database source bootstrap correction

Run 34385661322 passed frozen application verification, ten-migration replay,
246 PostgreSQL assertions and 82 core fixtures / 32 core race calls, but failed
when the new route decoder imported `@flexexa/domain` in the database job.
That job deliberately has no installed JavaScript dependencies. The previous
RPC runner created source links later; the newly added reader ran before it.
This was reproduced locally with `ERR_MODULE_NOT_FOUND` in a clean checkout.

A fixed source-only helper now validates/creates the two approved workspace
links before dynamic ESM imports. Both database readers use it, independently
of test order. No dependency downloads, environment credentials, resolver hooks
or changed lockfile. Unexpected links and redirected parent paths fail closed.
The Python runner exposes a bounded error tail rather than hiding the cause.
Six clean-copy regressions cover success, repeatability, invalid environment,
extra secret fields, wrong/dangling package links and redirected node_modules.

Supplemental Node22 run: 289 source tests passed, zero failed/skipped. The final
Node24/pnpm frozen application and complete real database CI remain required.
No prior tests, migrations, workflow or locked architecture were weakened.
PR11 was merged first at 9dc79da2477955f9d47c2e355621928316c8053a.

Skills activated: repository verification, impact, code/security review, test
strategy, Supabase and Turborepo. No UI/AWS/provider I/O changes; those skills
are intentionally out of scope. Phase0 and later product phases remain open.
Reference: Node24 package self-reference/subpath rules,
https://nodejs.org/docs/latest-v24.x/api/packages.html
