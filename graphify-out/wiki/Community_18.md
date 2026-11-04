# Community 18

> 16 nodes · cohesion 0.14

## Key Concepts

- **websocket.ts** (10 connections) — `server/websocket.ts`
- **ref_fs** (9 connections)
- **db** (8 connections) — `server/src/infrastructure/database/sqlite.ts`
- **audioCleanup.ts** (7 connections) — `server/jobs/audioCleanup.ts`
- **db.ts** (5 connections) — `server/db.ts`
- **node-cron** (4 connections) — `server/package.json`
- **server** (3 connections) — `server/index.ts`
- **startAudioCleanupJob()** (3 connections) — `server/jobs/audioCleanup.ts`
- **broadcastWsVoiceStatus()** (3 connections) — `server/websocket.ts`
- **setupVoiceWebSocket()** (3 connections) — `server/websocket.ts`
- **ref_crypto** (2 connections)
- **ref_http** (2 connections)
- **broadcastVoiceAiStatus()** (2 connections) — `server/index.ts`
- **node-cron@^4.2.1** (2 connections) — `server/package.json`
- **activeVoiceSockets** (1 connections) — `server/websocket.ts`
- **LiveSession** (1 connections) — `server/websocket.ts`

## Relationships

- [Community 4](Community_4.md) (12 shared connections)
- [Community 19](Community_19.md) (3 shared connections)
- [Community 9](Community_9.md) (2 shared connections)
- [Community 21](Community_21.md) (2 shared connections)
- [Community 27](Community_27.md) (2 shared connections)
- [Community 14](Community_14.md) (2 shared connections)
- [Community 1](Community_1.md) (2 shared connections)
- [Community 28](Community_28.md) (1 shared connections)
- [Community 24](Community_24.md) (1 shared connections)
- [Community 25](Community_25.md) (1 shared connections)
- [Community 22](Community_22.md) (1 shared connections)
- [Community 23](Community_23.md) (1 shared connections)

## Source Files

- `server/db.ts`
- `server/index.ts`
- `server/jobs/audioCleanup.ts`
- `server/package.json`
- `server/src/infrastructure/database/sqlite.ts`
- `server/websocket.ts`

## Audit Trail

- EXTRACTED: 47 (98%)
- INFERRED: 1 (2%)
- AMBIGUOUS: 0 (0%)

---

*Part of the graphify knowledge wiki. See [index](index.md) to navigate.*