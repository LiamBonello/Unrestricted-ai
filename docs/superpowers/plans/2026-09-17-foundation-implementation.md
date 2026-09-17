# Unrestricted AI Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first local-only vertical slice of Unrestricted AI: a persistent ChatGPT-style shell that streams a mock local assistant through the same provider, orchestration, resource-management, API, and persistence boundaries that later real models will use.

**Architecture:** Use one Next.js App Router application with server-only TypeScript modules for persistence and orchestration. The browser talks only to local Next.js route handlers; those route handlers call a provider-independent `ChatOrchestrator`, which serializes heavy capability access through a `ResourceManager`, streams from an `LLMProvider`, and persists conversations/messages to SQLite. No real model is downloaded in this milestone.

**Tech Stack:** Node.js 24 LTS, Next.js 16.3.3, React 19.3.0, TypeScript strict mode, Material UI 9.4.0, `@mui/material-nextjs` 9.4.0, SQLite through `better-sqlite3` 13.0.3, Vitest 5.0.1, React Testing Library 16.3.3.

**Spec:** `docs/superpowers/specs/2026-09-17-unrestricted-ai-v1-design.md`

## Global Constraints

- Work directly on `main`; do not create feature branches, PR branches, or worktrees.
- V1 runs locally on Windows and binds application services to localhost by default.
- Node.js baseline is Node 24 LTS; do not target Node 20 because it is EOL as of this plan date.
- Use Next.js 16.3.3 Active LTS rather than an older maintenance branch.
- Use Material UI 9.4.0 stable APIs only; prefer `Box`, `Stack`, `Typography`, and `sx`; do not use deprecated MUI APIs.
- TypeScript stays strict. Do not introduce `any`.
- Coding-specific assistant features are out of scope.
- Video is out of scope for this milestone; the future video provider supports text-to-video and image-to-video only.
- No paid AI API, authentication, billing, public hosting, cloud database, or multi-user scheduling.
- No model weights, generated assets, local databases, secrets, or machine-specific paths may be committed.
- The normal UI says `Unrestricted AI`; concrete provider/model names belong only in future diagnostics/settings.
- Keep provider/runtime details out of React UI components.

---

## File Structure

The foundation should finish with these responsibilities:

```text
.env.example                         documented local paths
.gitignore                           excludes local AI/data artifacts
.nvmrc                               Node 24 LTS major
package.json                         app/test/migration scripts and pinned core deps
next.config.ts                       server external package configuration
vitest.config.ts                     unit/component test configuration
vitest.setup.ts                      Testing Library DOM matchers

src/app/layout.tsx                   MUI/HTML root
src/app/page.tsx                     server entry for chat shell
src/app/api/health/route.ts          localhost health check
src/app/api/conversations/route.ts   list/create conversations
src/app/api/conversations/[id]/route.ts fetch one conversation and messages
src/app/api/chat/route.ts            NDJSON streaming chat endpoint

src/theme/theme.ts                   app theme
src/theme/AppThemeProvider.tsx       MUI Next.js cache + ThemeProvider

src/server/config/paths.ts           machine-independent data path resolution
src/server/db/database.ts            SQLite connection factory
src/server/db/migrations/types.ts    migration contract
src/server/db/migrations/0001-initial.ts initial schema
src/server/db/migrate.ts             idempotent migration runner
src/server/db/migrate-cli.ts         explicit migration command

src/server/conversations/types.ts    provider-independent conversation domain types
src/server/conversations/repository.ts SQLite persistence mapping
src/server/conversations/service.ts  IDs/timestamps/domain operations

src/server/providers/types.ts        LLM/Image/Video provider contracts
src/server/providers/mock-llm-provider.ts streaming foundation provider
src/server/resources/resource-manager.ts single-heavy-workload queue
src/server/chat/types.ts             API/orchestrator stream event types
src/server/chat/chat-orchestrator.ts conversation + provider coordination
src/server/app-container.ts          singleton server composition root

src/features/chat/api/chat-stream.ts browser NDJSON client/parser
src/features/chat/components/ChatClient.tsx stateful chat controller
src/features/chat/components/ConversationSidebar.tsx conversation navigation
src/features/chat/components/MessageList.tsx message rendering
src/features/chat/components/Composer.tsx input/send/stop controls
src/features/chat/components/ChatShell.tsx responsive MUI layout
```

Tests live beside their unit where practical using `*.test.ts` / `*.test.tsx`.

---

### Task 1: Bootstrap the local Next.js + MUI application

**Files:**
- Create: `package.json`
- Create: `.nvmrc`
- Create: `.env.example`
- Create/Modify: `.gitignore`
- Create: `tsconfig.json`
- Create: `next-env.d.ts`
- Create: `next.config.ts`
- Create: `eslint.config.mjs`
- Create: `vitest.config.ts`
- Create: `vitest.setup.ts`
- Create: `src/theme/theme.ts`
- Create: `src/theme/theme.test.ts`
- Create: `src/theme/AppThemeProvider.tsx`
- Create: `src/app/layout.tsx`
- Create: `src/app/page.tsx`

**Interfaces:**
- Produces: a runnable Next.js App Router application, MUI theme, strict TypeScript/test environment, and local-data ignore policy used by every later task.

- [ ] **Step 1: Write the failing theme test**

Create `src/theme/theme.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { theme } from './theme';

describe('theme', () => {
  it('uses the Unrestricted AI dark application baseline', () => {
    expect(theme.palette.mode).toBe('dark');
    expect(theme.typography.fontFamily).toContain('Segoe UI');
  });
});
```

- [ ] **Step 2: Add the project manifests and install dependencies**

Create `package.json` with these core versions:

```json
{
  "name": "unrestricted-ai",
  "version": "0.1.0",
  "private": true,
  "engines": { "node": ">=24 <25" },
  "scripts": {
    "dev": "next dev --hostname 127.0.0.1",
    "build": "next build",
    "start": "next start --hostname 127.0.0.1",
    "lint": "eslint .",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest",
    "db:migrate": "tsx src/server/db/migrate-cli.ts"
  },
  "dependencies": {
    "@emotion/cache": "^11.14.0",
    "@emotion/react": "^11.14.0",
    "@emotion/styled": "^11.14.0",
    "@mui/icons-material": "9.4.0",
    "@mui/material": "9.4.0",
    "@mui/material-nextjs": "9.4.0",
    "better-sqlite3": "13.0.3",
    "next": "16.3.3",
    "react": "19.3.0",
    "react-dom": "19.3.0"
  },
  "devDependencies": {
    "@testing-library/dom": "^10.4.1",
    "@testing-library/jest-dom": "^6.8.0",
    "@testing-library/react": "16.3.3",
    "@types/better-sqlite3": "^7.6.13",
    "@types/node": "^24.0.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "eslint": "^9.0.0",
    "eslint-config-next": "16.3.3",
    "jsdom": "^27.0.0",
    "tsx": "4.23.13",
    "typescript": "^5.9.0",
    "vitest": "5.0.1"
  }
}
```

Then run:

```bash
npm install
```

Create `.nvmrc`:

```text
24
```

Create `.env.example`:

```dotenv
UNRESTRICTED_AI_DATA_DIR=./data
UNRESTRICTED_AI_MODELS_DIR=./models
UNRESTRICTED_AI_OUTPUTS_DIR=./outputs
```

Ensure `.gitignore` contains:

```gitignore
node_modules/
.next/
coverage/
.env
.env.*
!.env.example
models/
outputs/
uploads/
cache/
data/*.db
data/*.db-*
*.gguf
*.safetensors
*.ckpt
*.pt
*.pth
```

- [ ] **Step 3: Add strict TypeScript, Next.js, ESLint, and Vitest configuration**

`next.config.ts` must keep the SQLite native module server-side:

```ts
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  serverExternalPackages: ['better-sqlite3'],
};

export default nextConfig;
```

`vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    restoreMocks: true,
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
});
```

`vitest.setup.ts`:

```ts
import '@testing-library/jest-dom/vitest';
```

Use Next.js strict defaults in `tsconfig.json` and keep `strict: true`, `noEmit: true`, and alias `@/* -> ./src/*`.

- [ ] **Step 4: Run the test and verify it fails**

Run:

```bash
npm test -- src/theme/theme.test.ts
```

Expected: FAIL because `src/theme/theme.ts` does not exist.

- [ ] **Step 5: Implement the MUI theme and root integration**

`src/theme/theme.ts`:

```ts
'use client';

import { createTheme } from '@mui/material/styles';

export const theme = createTheme({
  palette: {
    mode: 'dark',
    background: {
      default: '#0b0d10',
      paper: '#12161b',
    },
  },
  shape: { borderRadius: 12 },
  typography: {
    fontFamily: '"Segoe UI", system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
  },
});
```

`src/theme/AppThemeProvider.tsx`:

```tsx
'use client';

import { AppRouterCacheProvider } from '@mui/material-nextjs/v16-appRouter';
import CssBaseline from '@mui/material/CssBaseline';
import { ThemeProvider } from '@mui/material/styles';
import type { PropsWithChildren } from 'react';
import { theme } from './theme';

export function AppThemeProvider({ children }: PropsWithChildren) {
  return (
    <AppRouterCacheProvider>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </ThemeProvider>
    </AppRouterCacheProvider>
  );
}
```

`src/app/layout.tsx` should wrap children in `AppThemeProvider`, set metadata title to `Unrestricted AI`, and avoid remote web fonts so the local app remains buildable without a font CDN.

`src/app/page.tsx` initially renders a centered `Typography` heading `Unrestricted AI` and will be replaced by `ChatShell` in Task 7.

- [ ] **Step 6: Verify the bootstrap**

Run:

```bash
npm test -- src/theme/theme.test.ts
npm run typecheck
npm run lint
npm run build
```

Expected: all pass.

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json .nvmrc .env.example .gitignore tsconfig.json next-env.d.ts next.config.ts eslint.config.mjs vitest.config.ts vitest.setup.ts src/app src/theme
git commit -m "chore: bootstrap local Unrestricted AI app"
```

---

### Task 2: Add SQLite connection and idempotent migrations

**Files:**
- Create: `src/server/config/paths.ts`
- Create: `src/server/db/database.ts`
- Create: `src/server/db/migrations/types.ts`
- Create: `src/server/db/migrations/0001-initial.ts`
- Create: `src/server/db/migrate.ts`
- Create: `src/server/db/migrate.test.ts`
- Create: `src/server/db/migrate-cli.ts`

**Interfaces:**
- Produces: `createDatabase(filename: string): Database.Database`
- Produces: `runMigrations(db: Database.Database): void`
- Produces: `getDataPaths(): { dataDir: string; databaseFile: string; modelsDir: string; outputsDir: string }`

- [ ] **Step 1: Write the failing migration test**

`src/server/db/migrate.test.ts`:

```ts
import { afterEach, describe, expect, it } from 'vitest';
import type Database from 'better-sqlite3';
import { createDatabase } from './database';
import { runMigrations } from './migrate';

let db: Database.Database | undefined;

afterEach(() => db?.close());

describe('runMigrations', () => {
  it('creates the foundation schema and is idempotent', () => {
    db = createDatabase(':memory:');
    runMigrations(db);
    runMigrations(db);

    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")
      .all() as Array<{ name: string }>;

    expect(tables.map(({ name }) => name)).toEqual(
      expect.arrayContaining(['schema_migrations', 'conversations', 'messages']),
    );

    const applied = db.prepare('SELECT COUNT(*) AS count FROM schema_migrations').get() as { count: number };
    expect(applied.count).toBe(1);
  });
});
```

- [ ] **Step 2: Run it to verify failure**

```bash
npm test -- src/server/db/migrate.test.ts
```

Expected: FAIL because database modules do not exist.

- [ ] **Step 3: Implement path resolution and database creation**

`src/server/config/paths.ts` must resolve configured paths relative to `process.cwd()` and never expose Windows-specific drive letters in source:

```ts
import path from 'node:path';

function resolveLocalPath(value: string | undefined, fallback: string): string {
  return path.resolve(process.cwd(), value?.trim() || fallback);
}

export function getDataPaths() {
  const dataDir = resolveLocalPath(process.env.UNRESTRICTED_AI_DATA_DIR, './data');
  return {
    dataDir,
    databaseFile: path.join(dataDir, 'unrestricted-ai.db'),
    modelsDir: resolveLocalPath(process.env.UNRESTRICTED_AI_MODELS_DIR, './models'),
    outputsDir: resolveLocalPath(process.env.UNRESTRICTED_AI_OUTPUTS_DIR, './outputs'),
  } as const;
}
```

`src/server/db/database.ts`:

```ts
import Database from 'better-sqlite3';

export function createDatabase(filename: string): Database.Database {
  const db = new Database(filename);
  db.pragma('foreign_keys = ON');
  if (filename !== ':memory:') db.pragma('journal_mode = WAL');
  return db;
}
```

- [ ] **Step 4: Implement the migration contract and initial schema**

`src/server/db/migrations/types.ts`:

```ts
export interface Migration {
  version: number;
  name: string;
  sql: string;
}
```

`0001-initial.ts` creates `conversations` and `messages`. Store message content as JSON text (`parts_json`) so later image/video parts can be added without changing this storage shape:

```ts
import type { Migration } from './types';

export const initialMigration: Migration = {
  version: 1,
  name: 'initial conversations and messages',
  sql: `
    CREATE TABLE conversations (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE messages (
      id TEXT PRIMARY KEY,
      conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
      role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
      parts_json TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE INDEX messages_conversation_created_idx
      ON messages(conversation_id, created_at);
  `,
};
```

`runMigrations` creates `schema_migrations`, applies unapplied migrations inside transactions, and records each version only after successful SQL execution.

- [ ] **Step 5: Add the explicit CLI migration entry**

`migrate-cli.ts` must create `dataDir` recursively before opening the DB, run migrations, close the connection, and print only the resolved database path and success state. Do not print secrets/environment dumps.

- [ ] **Step 6: Verify database behavior**

```bash
npm test -- src/server/db/migrate.test.ts
npm run typecheck
npm run db:migrate
```

Expected: test PASS; local `data/unrestricted-ai.db` is created and is ignored by Git.

- [ ] **Step 7: Commit**

```bash
git add src/server/config src/server/db
 git commit -m "feat: add local SQLite persistence foundation"
```

---

### Task 3: Implement the conversation domain and persistence mapping

**Files:**
- Create: `src/server/conversations/types.ts`
- Create: `src/server/conversations/repository.ts`
- Create: `src/server/conversations/repository.test.ts`
- Create: `src/server/conversations/service.ts`
- Create: `src/server/conversations/service.test.ts`

**Interfaces:**
- Produces: `Conversation`, `Message`, `TextPart`, `MessageRole`
- Produces: `ConversationRepository`
- Produces: `ConversationService.createConversation(title?)`, `listConversations()`, `getConversation(id)`, `appendTextMessage(conversationId, role, text)`

- [ ] **Step 1: Write repository round-trip tests**

Test that a conversation and two text messages survive a repository read and that `parts_json` is mapped back to typed `TextPart[]`, not exposed to UI as raw JSON.

Representative assertion:

```ts
expect(result.messages).toEqual([
  expect.objectContaining({ role: 'user', parts: [{ type: 'text', text: 'Hello' }] }),
  expect.objectContaining({ role: 'assistant', parts: [{ type: 'text', text: 'Hi' }] }),
]);
```

- [ ] **Step 2: Run tests to verify failure**

```bash
npm test -- src/server/conversations
```

Expected: FAIL because conversation modules do not exist.

- [ ] **Step 3: Define strict domain types**

`types.ts`:

```ts
export type MessageRole = 'user' | 'assistant';

export interface TextPart {
  type: 'text';
  text: string;
}

export type MessagePart = TextPart;

export interface Message {
  id: string;
  conversationId: string;
  role: MessageRole;
  parts: MessagePart[];
  createdAt: string;
}

export interface ConversationSummary {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

export interface Conversation extends ConversationSummary {
  messages: Message[];
}
```

Keep `MessagePart` as a union even though v1 currently has only text; later image/video milestones extend the union in the mapping layer.

- [ ] **Step 4: Implement the repository mapping layer**

`ConversationRepository` accepts `Database.Database` in its constructor. All SQL row shapes remain private to this file. Parse JSON defensively and throw a descriptive persistence error if stored parts are malformed; do not leak database rows into UI types.

Required methods:

```ts
createConversation(conversation: ConversationSummary): void
listConversations(): ConversationSummary[]
getConversation(id: string): Conversation | null
insertMessage(message: Message): void
touchConversation(id: string, updatedAt: string): void
```

- [ ] **Step 5: Implement the service**

Use `crypto.randomUUID()` and ISO timestamps. The default title for a new blank conversation is `New conversation`. `appendTextMessage` rejects empty/whitespace-only text before persistence.

- [ ] **Step 6: Verify**

```bash
npm test -- src/server/conversations
npm run typecheck
```

Expected: all pass.

- [ ] **Step 7: Commit**

```bash
git add src/server/conversations
git commit -m "feat: add conversation domain and repository"
```

---

### Task 4: Add provider contracts, mock streaming provider, and GPU resource serialization

**Files:**
- Create: `src/server/providers/types.ts`
- Create: `src/server/providers/mock-llm-provider.ts`
- Create: `src/server/providers/mock-llm-provider.test.ts`
- Create: `src/server/resources/resource-manager.ts`
- Create: `src/server/resources/resource-manager.test.ts`

**Interfaces:**
- Produces: `LLMProvider.stream(request): AsyncIterable<LLMStreamEvent>`
- Produces: future-facing `ImageProvider` and `VideoProvider` contracts without concrete implementations
- Produces: `ResourceManager.runExclusive(capability, operation)`

- [ ] **Step 1: Write the provider and serialization tests**

Provider test:

```ts
it('streams text deltas and then done', async () => {
  const provider = new MockLLMProvider();
  const events = [];
  for await (const event of provider.stream({ prompt: 'Hello' })) events.push(event);
  expect(events.at(-1)).toEqual({ type: 'done' });
  expect(events.filter((event) => event.type === 'text-delta').length).toBeGreaterThan(1);
});
```

Resource test starts two deferred operations and asserts the second does not enter until the first releases.

- [ ] **Step 2: Run tests to verify failure**

```bash
npm test -- src/server/providers src/server/resources
```

- [ ] **Step 3: Define provider contracts**

`providers/types.ts`:

```ts
export interface LLMStreamRequest {
  prompt: string;
  signal?: AbortSignal;
}

export type LLMStreamEvent =
  | { type: 'text-delta'; text: string }
  | { type: 'done' };

export interface LLMProvider {
  readonly id: string;
  stream(request: LLMStreamRequest): AsyncIterable<LLMStreamEvent>;
}

export interface ImageGenerationRequest {
  prompt: string;
  inputImagePath?: string;
}

export interface ImageProvider {
  readonly id: string;
  generate(request: ImageGenerationRequest): Promise<{ outputPath: string }>;
}

export type VideoGenerationRequest =
  | { mode: 'text-to-video'; prompt: string }
  | { mode: 'image-to-video'; prompt: string; inputImagePath: string };

export interface VideoProvider {
  readonly id: string;
  generate(request: VideoGenerationRequest): Promise<{ outputPath: string }>;
}
```

Do not add a `video-to-video` mode.

- [ ] **Step 4: Implement the mock provider**

The mock provider returns a deterministic response such as `Local mock response: <prompt>` split into small text deltas. Before yielding each delta, check `signal?.aborted` and throw an `AbortError` using `DOMException`.

- [ ] **Step 5: Implement `ResourceManager`**

Capability type:

```ts
export type HeavyCapability = 'llm' | 'image' | 'video';
```

Expose:

```ts
runExclusive<T>(capability: HeavyCapability, operation: () => Promise<T>): Promise<T>
getActiveCapability(): HeavyCapability | null
```

Use one FIFO promise chain for all heavyweight capabilities. Always release in `finally`, including rejected/cancelled operations. Do not build a distributed scheduler.

- [ ] **Step 6: Verify**

```bash
npm test -- src/server/providers src/server/resources
npm run typecheck
```

- [ ] **Step 7: Commit**

```bash
git add src/server/providers src/server/resources
git commit -m "feat: add provider and resource manager contracts"
```

---

### Task 5: Build the streaming chat orchestrator

**Files:**
- Create: `src/server/chat/types.ts`
- Create: `src/server/chat/chat-orchestrator.ts`
- Create: `src/server/chat/chat-orchestrator.test.ts`

**Interfaces:**
- Consumes: `ConversationService`, `LLMProvider`, `ResourceManager`
- Produces: `ChatOrchestrator.stream({ conversationId?, text, signal? }): AsyncIterable<ChatStreamEvent>`

- [ ] **Step 1: Write orchestration tests**

Cover all three behaviors:

1. No conversation ID -> creates one and emits its ID first.
2. User message is persisted before provider generation; assistant message is persisted after completed streaming.
3. Aborted generation does not persist a completed assistant message and releases the resource manager.

Use event types:

```ts
export type ChatStreamEvent =
  | { type: 'conversation'; conversationId: string }
  | { type: 'delta'; text: string }
  | { type: 'done'; messageId: string };
```

- [ ] **Step 2: Run the failing tests**

```bash
npm test -- src/server/chat/chat-orchestrator.test.ts
```

- [ ] **Step 3: Implement orchestration**

Rules:

- Reject blank input before creating/persisting anything.
- Create a conversation when `conversationId` is absent.
- Persist the user text as a `user` message.
- For the mock milestone, construct the provider prompt from the current user text only. Full context construction belongs to Milestone 2 with the real LLM.
- Wrap provider consumption inside `resourceManager.runExclusive('llm', ...)`.
- Yield provider `text-delta` values as `{ type: 'delta' }`.
- Concatenate deltas in the orchestration layer.
- Persist one assistant text message only after provider completion.
- Yield `{ type: 'done', messageId }` last.
- Let `AbortError` propagate to the route layer; do not convert cancellation into a fake assistant message.

- [ ] **Step 4: Verify**

```bash
npm test -- src/server/chat/chat-orchestrator.test.ts
npm run typecheck
```

- [ ] **Step 5: Commit**

```bash
git add src/server/chat
git commit -m "feat: add streaming chat orchestration"
```

---

### Task 6: Expose the local orchestrator through route handlers

**Files:**
- Create: `src/server/app-container.ts`
- Create: `src/app/api/health/route.ts`
- Create: `src/app/api/conversations/route.ts`
- Create: `src/app/api/conversations/[id]/route.ts`
- Create: `src/app/api/chat/route.ts`
- Create: `src/server/chat/ndjson.ts`
- Create: `src/server/chat/ndjson.test.ts`

**Interfaces:**
- Produces: `GET /api/health`
- Produces: `GET /api/conversations`
- Produces: `POST /api/conversations`
- Produces: `GET /api/conversations/:id`
- Produces: `POST /api/chat` streaming `application/x-ndjson`

- [ ] **Step 1: Write the NDJSON serialization test**

```ts
import { describe, expect, it } from 'vitest';
import { encodeNdjson } from './ndjson';

describe('encodeNdjson', () => {
  it('emits exactly one JSON object per line', () => {
    expect(encodeNdjson({ type: 'delta', text: 'hello' })).toBe(
      '{"type":"delta","text":"hello"}\n',
    );
  });
});
```

- [ ] **Step 2: Run to verify failure**

```bash
npm test -- src/server/chat/ndjson.test.ts
```

- [ ] **Step 3: Implement the server composition root**

`app-container.ts` must lazily create one process-local container containing:

```ts
interface AppContainer {
  conversationService: ConversationService;
  chatOrchestrator: ChatOrchestrator;
  resourceManager: ResourceManager;
}
```

On first access:

1. resolve local paths
2. `mkdirSync(dataDir, { recursive: true })`
3. create SQLite DB
4. run migrations
5. create repository/service/resource manager/mock provider/orchestrator

Keep this module `server-only` and never import it from client components.

- [ ] **Step 4: Implement health and conversation endpoints**

`GET /api/health` returns:

```json
{
  "status": "ok",
  "app": "Unrestricted AI",
  "runtime": "local"
}
```

`POST /api/conversations` takes no required body and creates a conversation. `GET /api/conversations` returns summaries newest-updated first. `GET /api/conversations/[id]` returns 404 JSON when absent.

- [ ] **Step 5: Implement the streaming chat route**

Input shape:

```ts
interface ChatRequestBody {
  conversationId?: string;
  message: string;
}
```

Validate with explicit type guards; reject invalid/blank messages with HTTP 400. Connect `request.signal` to the orchestrator.

Create a `ReadableStream<Uint8Array>`, iterate `chatOrchestrator.stream`, encode each event with `encodeNdjson`, and respond with headers:

```ts
{
  'Content-Type': 'application/x-ndjson; charset=utf-8',
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff'
}
```

On an abort, close the stream without writing an error event. On another runtime error, emit one safe `{ "type": "error", "message": "Generation failed" }` line and close; detailed errors belong in server logs.

- [ ] **Step 6: Verify the API boundary**

Run unit checks:

```bash
npm test -- src/server/chat/ndjson.test.ts
npm run typecheck
npm run build
```

Then start locally:

```bash
npm run dev
```

Manual health smoke test in another terminal:

```bash
curl http://127.0.0.1:3000/api/health
```

Expected JSON includes `"status":"ok"`.

- [ ] **Step 7: Commit**

```bash
git add src/server/app-container.ts src/app/api src/server/chat/ndjson.ts src/server/chat/ndjson.test.ts
git commit -m "feat: expose local orchestration API"
```

---

### Task 7: Build the persistent ChatGPT-style UI shell

**Files:**
- Create: `src/features/chat/api/chat-stream.ts`
- Create: `src/features/chat/api/chat-stream.test.ts`
- Create: `src/features/chat/components/Composer.tsx`
- Create: `src/features/chat/components/MessageList.tsx`
- Create: `src/features/chat/components/ConversationSidebar.tsx`
- Create: `src/features/chat/components/ChatShell.tsx`
- Create: `src/features/chat/components/ChatClient.tsx`
- Create: `src/features/chat/components/ChatClient.test.tsx`
- Modify: `src/app/page.tsx`

**Interfaces:**
- Consumes: local `/api/conversations`, `/api/conversations/:id`, `/api/chat`
- Produces: one responsive local assistant UI with new conversation, history, streaming text, send, and stop.

- [ ] **Step 1: Write the browser stream parser test**

`chat-stream.test.ts` should feed chunks that split a JSON line across boundaries:

```ts
const chunks = [
  '{"type":"conversation","conversationId":"c1"}\n{"type":"del',
  'ta","text":"Hel"}\n{"type":"delta","text":"lo"}\n',
  '{"type":"done","messageId":"m2"}\n',
];
```

Assert parsed events preserve order and text.

- [ ] **Step 2: Run it to verify failure**

```bash
npm test -- src/features/chat/api/chat-stream.test.ts
```

- [ ] **Step 3: Implement `streamChat`**

Expose:

```ts
export async function* streamChat(
  input: { conversationId?: string; message: string; signal: AbortSignal },
): AsyncIterable<ChatClientEvent>
```

Use `fetch('/api/chat', { method: 'POST', ... })`, read `response.body` with `TextDecoder`, buffer incomplete lines, parse only complete non-empty lines, and throw a user-safe `Error` for non-OK responses or `{ type: 'error' }` events.

- [ ] **Step 4: Write the ChatClient behavior test**

Mock `streamChat` to emit conversation -> two deltas -> done. Assert:

- submitted user text appears immediately
- assistant placeholder becomes `Hello`
- composer is disabled while generating
- Stop button appears during generation
- after done, composer is enabled again

- [ ] **Step 5: Implement focused MUI components**

Use the following ownership boundaries:

- `Composer`: local input state only; calls `onSend(text)`; calls `onStop()`; uses MUI `TextField`, `IconButton`, `Stack`.
- `MessageList`: renders typed UI messages; assistant/user visual treatment only; no fetching.
- `ConversationSidebar`: renders summaries and selection/new callbacks; no database/API mapping.
- `ChatShell`: responsive layout only; uses `Box`, `Stack`, `Divider`; sidebar collapses below desktop width using MUI breakpoint `display` values.
- `ChatClient`: owns conversation selection, fetching, optimistic user message, active `AbortController`, stream consumption, and refresh of summaries.

Prevent interactive child clicks from triggering container selection where relevant by calling `event.stopPropagation()`.

The UI must not show `MockLLMProvider`, Qwen, llama.cpp, FLUX, or future runtime names.

- [ ] **Step 6: Replace the placeholder page**

`src/app/page.tsx` becomes a thin server component:

```tsx
import { ChatClient } from '@/features/chat/components/ChatClient';

export default function HomePage() {
  return <ChatClient />;
}
```

- [ ] **Step 7: Verify UI tests and build**

```bash
npm test -- src/features/chat
npm run typecheck
npm run lint
npm run build
```

Expected: all pass.

Manual check in browser at `http://127.0.0.1:3000`:

1. send `Hello`
2. observe streamed mock assistant text
3. create another conversation
4. return to first conversation and see persisted history
5. restart `npm run dev`
6. confirm first conversation still exists
7. send a message and press Stop while streaming; UI returns to idle without a fake completed assistant message

- [ ] **Step 8: Commit**

```bash
git add src/features/chat src/app/page.tsx
git commit -m "feat: add persistent local chat interface"
```

---

### Task 8: Document local setup and run the milestone acceptance gate

**Files:**
- Create: `README.md`
- Modify only if verification finds an actual issue: files from Tasks 1-7

**Interfaces:**
- Produces: repeatable Windows/VS Code startup instructions and an evidence-based Milestone 1 completion gate.

- [ ] **Step 1: Write README setup instructions**

README must contain exactly these concepts, with no cloud deployment instructions:

1. Prerequisites: Windows, Node 24 LTS, Git, VS Code.
2. Clone and `npm install`.
3. Copy `.env.example` to `.env.local` only if custom local paths are needed; defaults work without it.
4. `npm run db:migrate`.
5. `npm run dev` and open `http://127.0.0.1:3000`.
6. Explain that Milestone 1 intentionally uses a mock provider and downloads no AI model.
7. State that model weights/outputs/local DBs must remain outside Git.
8. State the branch policy: development occurs on `main` only.

- [ ] **Step 2: Run the full automated gate**

```bash
npm test
npm run typecheck
npm run lint
npm run build
```

Expected: every command exits 0.

- [ ] **Step 3: Run the persistence acceptance gate**

With the dev server running:

```bash
curl http://127.0.0.1:3000/api/health
curl -X POST http://127.0.0.1:3000/api/conversations
```

Use the browser to send a mock chat message, restart the process, and confirm history remains. This validates the design acceptance requirement: persistence across restart plus streamed response through the real provider/orchestrator boundary.

- [ ] **Step 4: Inspect Git for accidental local artifacts**

```bash
git status --short
git ls-files | grep -E '(\.gguf$|\.safetensors$|\.ckpt$|\.db$|^models/|^outputs/|^uploads/|^cache/)'
```

Expected: the second command prints nothing. `git status --short` contains only intended source/docs before commit.

- [ ] **Step 5: Commit**

```bash
git add README.md
git commit -m "docs: add local development setup"
```

- [ ] **Step 6: Final verification on `main`**

```bash
git branch --show-current
npm test
npm run typecheck
npm run lint
npm run build
```

Expected branch: `main`; all commands exit 0.

Milestone 1 is complete only after these checks pass. Do not begin llama.cpp/Qwen integration before this gate is green.
