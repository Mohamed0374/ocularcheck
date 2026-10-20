# backend/

Future home of the **NestJS API** (TypeScript strict, PostgreSQL + Prisma, Redis/BullMQ, Socket.IO) — modular and layered (plan §3.2).

> Scaffolded in **Phase 1 · P1-T3** (strict config, `/health`); API core in Phase 2, auth in Phase 3, features in Phases 7–13.

## Local development (Windows)

```bat
npm install
npm run start:dev
```

- Port comes from the `PORT` env variable (default `3000`); the app binds to `0.0.0.0`.
- Checks: `npm run lint` · `npm run format:check` · `npm test` · `npm run test:e2e` · `npm run build`
