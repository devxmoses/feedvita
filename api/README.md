# Nuvita API

The NestJS API for Nuvita. See the [root README](../README.md) for the project
overview, domain model, API reference and roadmap.

## Quick start

```bash
npm install
cp .env.example .env            # then fill it in

npx prisma migrate deploy
npx prisma generate

npm run start:dev               # http://localhost:3000, docs at /api/docs
```

## Checks

```bash
npx tsc --noEmit                # type check first - it catches what Jest cannot
npm test                        # 201 unit tests

npm run test:e2e:up             # start the throwaway Postgres container
npm run test:e2e                # 31 tests against a real database
npm run test:e2e:down           # tear it down
```

The e2e suite truncates every table before each test, so it refuses to run against
anything but a loopback host with a database name ending in `_test`.
