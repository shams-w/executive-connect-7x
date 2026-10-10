# Build Verification Record

Verification performed in the generation environment:

- Node.js detected: v22.16.0.
- npm detected: 10.9.2.
- PostgreSQL client/server: not present.
- Docker: not present.
- `npm install` was attempted, but the environment could not reach the npm registry before timeout, so third-party packages could not be installed here.
- Core TypeScript modules that do not require external packages were compiled with the globally available TypeScript compiler.
- A standalone Node assertion suite ran successfully with 14 assertions covering phone normalization/masking, date parsing including Excel serials, birthday detection, anniversary calculation, same-year exclusion, inactive/consent exclusion, and Feb-29 policy.
- Vitest/Supertest acceptance test files are included for the full application. PostgreSQL tests are gated by `RUN_DB_TESTS=1` and are designed to run after dependencies are installed and migrations are applied.

Because the execution environment lacks PostgreSQL/Docker and cannot currently download npm packages, this record does **not** claim that the complete React/Express application was launched here. Follow the README commands on a machine with npm registry access and PostgreSQL/Docker to run the full suite.
