# Community 2

> 41 nodes · cohesion 0.08

## Key Concepts

- **User** (13 connections) — `server/src/domain/entities/user.entity.ts`
- **IUserRepository** (13 connections) — `server/src/domain/repositories/user.repository.ts`
- **UserRepositorySqlite** (11 connections) — `server/src/adapters/repositories/user.repository.sqlite.ts`
- **AuthUseCase** (9 connections) — `server/src/usecases/auth/auth.usecase.ts`
- **user.repository.sqlite.ts** (8 connections) — `server/src/adapters/repositories/user.repository.sqlite.ts`
- **auth.middleware.ts** (8 connections) — `server/src/infrastructure/web/middlewares/auth.middleware.ts`
- **auth.usecase.ts** (8 connections) — `server/src/usecases/auth/auth.usecase.ts`
- **auth.controller.ts** (6 connections) — `server/src/adapters/controllers/auth.controller.ts`
- **AuthController** (5 connections) — `server/src/adapters/controllers/auth.controller.ts`
- **user.repository.ts** (5 connections) — `server/src/domain/repositories/user.repository.ts`
- **jsonwebtoken** (4 connections) — `server/package.json`
- **createAuthMiddleware()** (4 connections) — `server/src/infrastructure/web/middlewares/auth.middleware.ts`
- **.logout()** (3 connections) — `server/src/adapters/controllers/auth.controller.ts`
- **user.entity.ts** (3 connections) — `server/src/domain/entities/user.entity.ts`
- **.findByUsername()** (3 connections) — `server/src/domain/repositories/user.repository.ts`
- **.login()** (3 connections) — `server/src/usecases/auth/auth.usecase.ts`
- **.logout()** (3 connections) — `server/src/usecases/auth/auth.usecase.ts`
- **.verifyToken()** (3 connections) — `server/src/usecases/auth/auth.usecase.ts`
- **jsonwebtoken@^9.0.3** (2 connections) — `server/package.json`
- **.constructor()** (2 connections) — `server/src/adapters/controllers/auth.controller.ts`
- **.login()** (2 connections) — `server/src/adapters/controllers/auth.controller.ts`
- **parseCookies()** (2 connections) — `server/src/adapters/controllers/auth.controller.ts`
- **.create()** (2 connections) — `server/src/adapters/repositories/user.repository.sqlite.ts`
- **.findAll()** (2 connections) — `server/src/adapters/repositories/user.repository.sqlite.ts`
- **.findById()** (2 connections) — `server/src/adapters/repositories/user.repository.sqlite.ts`
- *... and 16 more nodes in this community*

## Relationships

- [Community 4](Community_4.md) (9 shared connections)
- [Community 1](Community_1.md) (2 shared connections)
- [Community 21](Community_21.md) (2 shared connections)
- [Community 23](Community_23.md) (1 shared connections)
- [Community 14](Community_14.md) (1 shared connections)
- [Community 18](Community_18.md) (1 shared connections)

## Source Files

- `server/package.json`
- `server/src/adapters/controllers/auth.controller.ts`
- `server/src/adapters/repositories/user.repository.sqlite.ts`
- `server/src/domain/entities/user.entity.ts`
- `server/src/domain/repositories/user.repository.ts`
- `server/src/infrastructure/web/middlewares/auth.middleware.ts`
- `server/src/usecases/auth/auth.usecase.ts`

## Audit Trail

- EXTRACTED: 78 (93%)
- INFERRED: 6 (7%)
- AMBIGUOUS: 0 (0%)

---

*Part of the graphify knowledge wiki. See [index](index.md) to navigate.*