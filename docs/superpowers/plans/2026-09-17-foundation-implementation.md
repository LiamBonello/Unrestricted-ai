# Unrestricted AI Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Because this repository is explicitly `main`-only, do not create a worktree, feature branch, or pull-request branch while executing this plan.

**Goal:** Build the first local-only vertical slice of Unrestricted AI: a persistent ChatGPT-style shell that streams a mock local assistant through the same provider, orchestration, resource-management, API, and persistence boundaries that later real local models will use.

**Architecture:** Use one Next.js App Router application. React components call local route handlers only; route handlers call a provider-independent `ChatOrchestrator`; the orchestrator persists messages through a conversation service, obtains exclusive heavy-resource access from a `ResourceManager`, and streams from an `LLMProvider`. SQLite stores metadata and conversation history; no real model is downloaded in this milestone.

**Tech Stack:** Node.js 24 LTS, Next.js 16.3.3, React 19.3.0, TypeScript strict mode, Material UI 9.4.0, `@mui/material-nextjs` 9.4.0, `better-sqlite3` 13.0.3, Vitest 5.0.1, React Testing Library 16.3.3.

**Spec:** `docs/superpowers/specs/2026-09-17-unrestricted-ai-v1-design.md`

## Global Constraints

- Work directly on `main`; never create another branch, PR branch, or worktree.
- Run v1 locally on Windows; app processes bind to `127.0.0.1` by default.
- Use Node.js 24 LTS. Node.js 20 is EOL and must not be selected for this new project.
- Use Next.js 16.3.3 Active LTS and Material UI 9.4.0 stable APIs.
- Prefer MUI `Box`, `Stack`, `Typography`, `sx`, and theme values. Do not use deprecated MUI APIs.
- TypeScript remains strict. Do not use `any` or widen API/domain types unnecessarily.
- Coding-specific assistant functionality is out of scope.
- Video is out of scope for this milestone. Future `VideoProvider` supports text-to-video and image-to-video only; no video-to-video API is permitted.
- Do not introduce authentication, billing, cloud deployment, public API hosting, paid AI APIs, cloud databases, or multi-user scheduling.
- Never commit model weights, generated assets, local databases, secrets, caches, or hard-coded machine-specific drive paths.
- UI says `Unrestricted AI`; concrete runtime/model names remain implementation details.
- API/storage row transformations live in server mapping modules, not React components.

## Target File Map

```text
.env.example
.gitignore
.nvmrc
package.json
next.config.ts
tsconfig.json
eslint.config.mjs
vitest.config.ts
vitest.setup.ts

src/app/layout.tsx
src/app/page.tsx
src/app/api/health/route.ts
src/app/api/conversations/route.ts
src/app/api/conversations/[id]/route.ts
src/app/api/chat/route.ts

src/theme/theme.ts
src/theme/AppThemeProvider.tsx

src/shared/conversation.ts
src/shared/chat.ts

src/server/config/paths.ts
src/server/db/database.ts
src/server/db/migrations/types.ts
src/server/db/migrations/0001-initial.ts
src/server/db/migrate.ts
src/server/db/migrate-cli.ts
src/server/conversations/repository.ts
src/server/conversations/service.ts
src/server/providers/types.ts
src/server/providers/mock-llm-provider.ts
src/server/resources/resource-manager.ts
src/server/chat/chat-orchestrator.ts
src/server/chat/ndjson.ts
src/server/app-container.ts

src/features/chat/api/chat-api.ts
src/features/chat/components/Composer.tsx
src/features/chat/components/MessageList.tsx
src/features/chat/components/ConversationSidebar.tsx
src/features/chat/components/ChatShell.tsx
src/features/chat/components/ChatClient.tsx
```

Tests live beside their unit using `*.test.ts` / `*.test.tsx`.

---

### Task 1: Bootstrap Next.js, strict TypeScript, tests, and MUI

**Files:** root config files, `src/theme/*`, `src/app/layout.tsx`, `src/app/page.tsx`

**Produces:** a runnable localhost-only Next.js shell with stable MUI integration and a green unit-test/build toolchain.

- [ ] **Step 1: Write the failing theme test**

Create `src/theme/theme.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { theme } from './theme';

describe('theme', () => {
  it('uses the Unrestricted AI dark baseline', () => {
    expect(theme.palette.mode).toBe('dark');
    expect(theme.typography.fontFamily).toContain('Segoe UI');
  });
});
```

- [ ] **Step 2: Create `package.json` and local-artifact configuration**

Use exactly this initial manifest:

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

Create/merge `.gitignore`:

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

Run:

```bash
npm install
```

- [ ] **Step 3: Create exact framework/test configuration**

`tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2017",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": false,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./src/*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

`next-env.d.ts`:

```ts
/// <reference types="next" />
/// <reference types="next/image-types/global" />
```

`next.config.ts`:

```ts
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  serverExternalPackages: ['better-sqlite3'],
};

export default nextConfig;
```

`eslint.config.mjs`:

```js
import { defineConfig } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';

export default defineConfig([...nextVitals, ...nextTs]);
```

`vitest.config.ts`:

```ts
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

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

- [ ] **Step 4: Run the theme test and confirm RED**

```bash
npm test -- src/theme/theme.test.ts
```

Expected: FAIL because `theme.ts` does not exist.

- [ ] **Step 5: Implement the theme and root shell**

`src/theme/theme.ts`:

```ts
'use client';

import { createTheme } from '@mui/material/styles';

export const theme = createTheme({
  palette: {
    mode: 'dark',
    background: { default: '#0b0d10', paper: '#12161b' },
  },
  shape: { borderRadius: 12 },
  typography: {
    fontFamily: '"Segoe UI", system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        'html, body': { minHeight: '100%' },
        body: { margin: 0 },
      },
    },
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

`src/app/layout.tsx`:

```tsx
import type { Metadata } from 'next';
import type { PropsWithChildren } from 'react';
import { AppThemeProvider } from '@/theme/AppThemeProvider';

export const metadata: Metadata = {
  title: 'Unrestricted AI',
  description: 'Local-first personal AI assistant',
};

export default function RootLayout({ children }: PropsWithChildren) {
  return (
    <html lang="en">
      <body>
        <AppThemeProvider>{children}</AppThemeProvider>
      </body>
    </html>
  );
}
```

`src/app/page.tsx`:

```tsx
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';

export default function HomePage() {
  return (
    <Box sx={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}>
      <Typography variant="h3">Unrestricted AI</Typography>
    </Box>
  );
}
```

- [ ] **Step 6: Verify GREEN and commit**

```bash
npm test -- src/theme/theme.test.ts
npm run typecheck
npm run lint
npm run build
git add package.json package-lock.json .nvmrc .env.example .gitignore tsconfig.json next-env.d.ts next.config.ts eslint.config.mjs vitest.config.ts vitest.setup.ts src/theme src/app
git commit -m "chore: bootstrap local Unrestricted AI app"
```

---

### Task 2: Add SQLite and idempotent migrations

**Files:** `src/server/config/paths.ts`, `src/server/db/**`

**Produces:** `createDatabase`, `runMigrations`, and configurable local data/model/output paths.

- [ ] **Step 1: Write the failing migration test**

`src/server/db/migrate.test.ts`:

```ts
import type Database from 'better-sqlite3';
import { afterEach, describe, expect, it } from 'vitest';
import { createDatabase } from './database';
import { runMigrations } from './migrate';

let db: Database.Database | undefined;

afterEach(() => {
  db?.close();
  db = undefined;
});

describe('runMigrations', () => {
  it('creates the schema once', () => {
    db = createDatabase(':memory:');
    runMigrations(db);
    runMigrations(db);

    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")
      .all() as Array<{ name: string }>;

    expect(tables.map(({ name }) => name)).toEqual(
      expect.arrayContaining(['schema_migrations', 'conversations', 'messages']),
    );

    const row = db.prepare('SELECT COUNT(*) AS count FROM schema_migrations').get() as { count: number };
    expect(row.count).toBe(1);
  });
});
```

- [ ] **Step 2: Run and confirm RED**

```bash
npm test -- src/server/db/migrate.test.ts
```

- [ ] **Step 3: Implement paths and DB factory**

`src/server/config/paths.ts`:

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

- [ ] **Step 4: Implement exact migration definitions and runner**

`src/server/db/migrations/types.ts`:

```ts
export interface Migration {
  version: number;
  name: string;
  sql: string;
}
```

`src/server/db/migrations/0001-initial.ts`:

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
      ON messages(conversation_id, created_at, id);
  `,
};
```

`src/server/db/migrate.ts`:

```ts
import type Database from 'better-sqlite3';
import { initialMigration } from './migrations/0001-initial';
import type { Migration } from './migrations/types';

const migrations: readonly Migration[] = [initialMigration];

export function runMigrations(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL
    );
  `);

  const appliedRows = db.prepare('SELECT version FROM schema_migrations').all() as Array<{ version: number }>;
  const applied = new Set(appliedRows.map(({ version }) => version));
  const insert = db.prepare(
    'INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)',
  );

  const apply = db.transaction((migration: Migration) => {
    db.exec(migration.sql);
    insert.run(migration.version, migration.name, new Date().toISOString());
  });

  for (const migration of migrations) {
    if (!applied.has(migration.version)) apply(migration);
  }
}
```

`src/server/db/migrate-cli.ts`:

```ts
import { mkdirSync } from 'node:fs';
import { getDataPaths } from '@/server/config/paths';
import { createDatabase } from './database';
import { runMigrations } from './migrate';

const paths = getDataPaths();
mkdirSync(paths.dataDir, { recursive: true });
const db = createDatabase(paths.databaseFile);

try {
  runMigrations(db);
  console.log(`Migrated ${paths.databaseFile}`);
} finally {
  db.close();
}
```

- [ ] **Step 5: Verify GREEN and commit**

```bash
npm test -- src/server/db/migrate.test.ts
npm run typecheck
npm run db:migrate
git add src/server/config src/server/db
git commit -m "feat: add local SQLite persistence foundation"
```

---

### Task 3: Add typed conversation domain, repository, and service

**Files:** `src/shared/conversation.ts`, `src/server/conversations/repository.ts`, `src/server/conversations/service.ts`, colocated tests.

**Produces:** typed conversation/message APIs. SQL row/JSON mapping stays inside the repository.

- [ ] **Step 1: Write the failing repository/service tests**

`src/server/conversations/repository.test.ts` must initialize an in-memory migrated DB, insert a conversation and two messages, then assert:

```ts
expect(repository.getConversation('c1')?.messages).toEqual([
  expect.objectContaining({ role: 'user', parts: [{ type: 'text', text: 'Hello' }] }),
  expect.objectContaining({ role: 'assistant', parts: [{ type: 'text', text: 'Hi' }] }),
]);
```

`src/server/conversations/service.test.ts` must assert whitespace-only messages throw and valid messages receive IDs/timestamps.

Run and confirm RED:

```bash
npm test -- src/server/conversations
```

- [ ] **Step 2: Define exact shared domain types**

`src/shared/conversation.ts`:

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

- [ ] **Step 3: Implement the repository mapping layer**

`src/server/conversations/repository.ts`:

```ts
import type Database from 'better-sqlite3';
import type {
  Conversation,
  ConversationSummary,
  Message,
  MessagePart,
  MessageRole,
  TextPart,
} from '@/shared/conversation';

interface ConversationRow {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

interface MessageRow {
  id: string;
  conversation_id: string;
  role: MessageRole;
  parts_json: string;
  created_at: string;
}

function isTextPart(value: unknown): value is TextPart {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return candidate.type === 'text' && typeof candidate.text === 'string';
}

function parseParts(value: string): MessagePart[] {
  const parsed: unknown = JSON.parse(value);
  if (!Array.isArray(parsed) || !parsed.every(isTextPart)) {
    throw new Error('Stored message parts are invalid');
  }
  return parsed;
}

function mapConversation(row: ConversationRow): ConversationSummary {
  return {
    id: row.id,
    title: row.title,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapMessage(row: MessageRow): Message {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    role: row.role,
    parts: parseParts(row.parts_json),
    createdAt: row.created_at,
  };
}

export class ConversationRepository {
  constructor(private readonly db: Database.Database) {}

  createConversation(conversation: ConversationSummary): void {
    this.db
      .prepare(`
        INSERT INTO conversations (id, title, created_at, updated_at)
        VALUES (@id, @title, @createdAt, @updatedAt)
      `)
      .run(conversation);
  }

  listConversations(): ConversationSummary[] {
    const rows = this.db
      .prepare(`
        SELECT id, title, created_at, updated_at
        FROM conversations
        ORDER BY updated_at DESC, id DESC
      `)
      .all() as ConversationRow[];
    return rows.map(mapConversation);
  }

  getConversation(id: string): Conversation | null {
    const row = this.db
      .prepare('SELECT id, title, created_at, updated_at FROM conversations WHERE id = ?')
      .get(id) as ConversationRow | undefined;
    if (!row) return null;

    const messageRows = this.db
      .prepare(`
        SELECT id, conversation_id, role, parts_json, created_at
        FROM messages
        WHERE conversation_id = ?
        ORDER BY created_at ASC, id ASC
      `)
      .all(id) as MessageRow[];

    return { ...mapConversation(row), messages: messageRows.map(mapMessage) };
  }

  insertMessage(message: Message): void {
    this.db
      .prepare(`
        INSERT INTO messages (id, conversation_id, role, parts_json, created_at)
        VALUES (@id, @conversationId, @role, @partsJson, @createdAt)
      `)
      .run({
        id: message.id,
        conversationId: message.conversationId,
        role: message.role,
        partsJson: JSON.stringify(message.parts),
        createdAt: message.createdAt,
      });
  }

  touchConversation(id: string, updatedAt: string): void {
    this.db.prepare('UPDATE conversations SET updated_at = ? WHERE id = ?').run(updatedAt, id);
  }
}
```

- [ ] **Step 4: Implement the domain service**

`src/server/conversations/service.ts`:

```ts
import { randomUUID } from 'node:crypto';
import type { Conversation, ConversationSummary, Message, MessageRole } from '@/shared/conversation';
import { ConversationRepository } from './repository';

export class ConversationService {
  constructor(
    private readonly repository: ConversationRepository,
    private readonly createId: () => string = randomUUID,
    private readonly now: () => string = () => new Date().toISOString(),
  ) {}

  createConversation(title = 'New conversation'): ConversationSummary {
    const timestamp = this.now();
    const conversation: ConversationSummary = {
      id: this.createId(),
      title: title.trim() || 'New conversation',
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    this.repository.createConversation(conversation);
    return conversation;
  }

  listConversations(): ConversationSummary[] {
    return this.repository.listConversations();
  }

  getConversation(id: string): Conversation | null {
    return this.repository.getConversation(id);
  }

  appendTextMessage(conversationId: string, role: MessageRole, text: string): Message {
    const normalized = text.trim();
    if (!normalized) throw new Error('Message text cannot be empty');
    if (!this.repository.getConversation(conversationId)) throw new Error('Conversation not found');

    const createdAt = this.now();
    const message: Message = {
      id: this.createId(),
      conversationId,
      role,
      parts: [{ type: 'text', text: normalized }],
      createdAt,
    };
    this.repository.insertMessage(message);
    this.repository.touchConversation(conversationId, createdAt);
    return message;
  }
}
```

- [ ] **Step 5: Verify GREEN and commit**

```bash
npm test -- src/server/conversations
npm run typecheck
git add src/shared/conversation.ts src/server/conversations
git commit -m "feat: add conversation domain and persistence mapping"
```

---

### Task 4: Add provider contracts, mock LLM, and exclusive heavy-resource leasing

**Files:** `src/server/providers/*`, `src/server/resources/*`

**Produces:** replaceable LLM/Image/Video contracts and a FIFO lease that prevents concurrent heavy GPU workloads later.

- [ ] **Step 1: Write RED tests**

Provider test:

```ts
it('streams multiple deltas and then done', async () => {
  const provider = new MockLLMProvider();
  const events = [];
  for await (const event of provider.stream({ prompt: 'Hello' })) events.push(event);
  expect(events.at(-1)).toEqual({ type: 'done' });
  expect(events.filter((event) => event.type === 'text-delta').length).toBeGreaterThan(1);
});
```

Resource-manager test must acquire `llm`, begin an `image` acquire, assert image has not acquired yet, release LLM, then assert image acquires. Run:

```bash
npm test -- src/server/providers src/server/resources
```

- [ ] **Step 2: Define provider contracts without video-to-video**

`src/server/providers/types.ts`:

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

- [ ] **Step 3: Implement deterministic mock streaming**

`src/server/providers/mock-llm-provider.ts`:

```ts
import type { LLMProvider, LLMStreamRequest, LLMStreamEvent } from './types';

export class MockLLMProvider implements LLMProvider {
  readonly id = 'local-mock';

  async *stream(request: LLMStreamRequest): AsyncIterable<LLMStreamEvent> {
    const response = `Local mock response: ${request.prompt}`;
    const chunks = response.match(/.{1,8}/g) ?? [];

    for (const text of chunks) {
      if (request.signal?.aborted) throw new DOMException('Generation aborted', 'AbortError');
      await Promise.resolve();
      yield { type: 'text-delta', text };
    }

    if (request.signal?.aborted) throw new DOMException('Generation aborted', 'AbortError');
    yield { type: 'done' };
  }
}
```

- [ ] **Step 4: Implement FIFO resource leasing**

`src/server/resources/resource-manager.ts`:

```ts
export type HeavyCapability = 'llm' | 'image' | 'video';

export interface ResourceLease {
  capability: HeavyCapability;
  release(): void;
}

export class ResourceManager {
  private tail: Promise<void> = Promise.resolve();
  private active: HeavyCapability | null = null;

  getActiveCapability(): HeavyCapability | null {
    return this.active;
  }

  async acquire(capability: HeavyCapability): Promise<ResourceLease> {
    let releaseSlot!: () => void;
    const slot = new Promise<void>((resolve) => {
      releaseSlot = resolve;
    });

    const previous = this.tail;
    this.tail = previous.catch(() => undefined).then(() => slot);
    await previous.catch(() => undefined);
    this.active = capability;

    let released = false;
    return {
      capability,
      release: () => {
        if (released) return;
        released = true;
        this.active = null;
        releaseSlot();
      },
    };
  }
}
```

- [ ] **Step 5: Verify GREEN and commit**

```bash
npm test -- src/server/providers src/server/resources
npm run typecheck
git add src/server/providers src/server/resources
git commit -m "feat: add provider and resource manager contracts"
```

---

### Task 5: Build provider-independent streaming chat orchestration

**Files:** `src/shared/chat.ts`, `src/server/chat/chat-orchestrator.ts`, test.

**Produces:** one async event stream that persists user/assistant messages while keeping model details outside API/UI layers.

- [ ] **Step 1: Write RED orchestration tests**

Tests must prove:

- absent `conversationId` creates a conversation and emits it before deltas;
- user message persists before provider consumption;
- assistant message persists only after provider `done`;
- provider abort leaves no completed assistant message;
- lease releases on both success and abort.

Run:

```bash
npm test -- src/server/chat/chat-orchestrator.test.ts
```

- [ ] **Step 2: Define shared stream events**

`src/shared/chat.ts`:

```ts
export type ChatStreamEvent =
  | { type: 'conversation'; conversationId: string }
  | { type: 'delta'; text: string }
  | { type: 'done'; messageId: string };

export type ChatTransportEvent =
  | ChatStreamEvent
  | { type: 'error'; message: string };
```

- [ ] **Step 3: Implement the orchestrator**

`src/server/chat/chat-orchestrator.ts`:

```ts
import type { ChatStreamEvent } from '@/shared/chat';
import { ConversationService } from '@/server/conversations/service';
import type { LLMProvider } from '@/server/providers/types';
import { ResourceManager } from '@/server/resources/resource-manager';

export interface ChatInput {
  conversationId?: string;
  text: string;
  signal?: AbortSignal;
}

export class ChatOrchestrator {
  constructor(
    private readonly conversations: ConversationService,
    private readonly llm: LLMProvider,
    private readonly resources: ResourceManager,
  ) {}

  async *stream(input: ChatInput): AsyncIterable<ChatStreamEvent> {
    const text = input.text.trim();
    if (!text) throw new Error('Message text cannot be empty');

    let conversationId = input.conversationId;
    if (conversationId) {
      if (!this.conversations.getConversation(conversationId)) throw new Error('Conversation not found');
    } else {
      conversationId = this.conversations.createConversation().id;
      yield { type: 'conversation', conversationId };
    }

    this.conversations.appendTextMessage(conversationId, 'user', text);
    const lease = await this.resources.acquire('llm');
    let assistantText = '';

    try {
      for await (const event of this.llm.stream({ prompt: text, signal: input.signal })) {
        if (event.type === 'text-delta') {
          assistantText += event.text;
          yield { type: 'delta', text: event.text };
        }
      }

      if (!assistantText.trim()) throw new Error('Provider returned an empty response');
      const message = this.conversations.appendTextMessage(conversationId, 'assistant', assistantText);
      yield { type: 'done', messageId: message.id };
    } finally {
      lease.release();
    }
  }
}
```

Milestone 1 deliberately sends only the current prompt to the mock provider. Full multi-message context construction belongs to Milestone 2 with the real local LLM.

- [ ] **Step 4: Verify GREEN and commit**

```bash
npm test -- src/server/chat/chat-orchestrator.test.ts
npm run typecheck
git add src/shared/chat.ts src/server/chat/chat-orchestrator.ts src/server/chat/chat-orchestrator.test.ts
git commit -m "feat: add streaming chat orchestration"
```

---

### Task 6: Expose health, conversations, and NDJSON chat locally

**Files:** `src/server/chat/ndjson.ts`, `src/server/app-container.ts`, `src/app/api/**`, tests.

**Produces:** localhost route handlers with a stable stream protocol.

- [ ] **Step 1: Write RED NDJSON test**

`src/server/chat/ndjson.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { encodeNdjson } from './ndjson';

describe('encodeNdjson', () => {
  it('encodes exactly one event per line', () => {
    expect(encodeNdjson({ type: 'delta', text: 'hello' })).toBe(
      '{"type":"delta","text":"hello"}\n',
    );
  });
});
```

Run:

```bash
npm test -- src/server/chat/ndjson.test.ts
```

- [ ] **Step 2: Implement NDJSON and the singleton app container**

`src/server/chat/ndjson.ts`:

```ts
export function encodeNdjson(value: unknown): string {
  return `${JSON.stringify(value)}\n`;
}
```

`src/server/app-container.ts`:

```ts
import { mkdirSync } from 'node:fs';
import { ChatOrchestrator } from '@/server/chat/chat-orchestrator';
import { getDataPaths } from '@/server/config/paths';
import { ConversationRepository } from '@/server/conversations/repository';
import { ConversationService } from '@/server/conversations/service';
import { createDatabase } from '@/server/db/database';
import { runMigrations } from '@/server/db/migrate';
import { MockLLMProvider } from '@/server/providers/mock-llm-provider';
import { ResourceManager } from '@/server/resources/resource-manager';

export interface AppContainer {
  conversations: ConversationService;
  chat: ChatOrchestrator;
  resources: ResourceManager;
}

const globalState = globalThis as typeof globalThis & {
  __unrestrictedAiContainer?: AppContainer;
};

function createContainer(): AppContainer {
  const paths = getDataPaths();
  mkdirSync(paths.dataDir, { recursive: true });
  const db = createDatabase(paths.databaseFile);
  runMigrations(db);

  const repository = new ConversationRepository(db);
  const conversations = new ConversationService(repository);
  const resources = new ResourceManager();
  const llm = new MockLLMProvider();

  return {
    conversations,
    resources,
    chat: new ChatOrchestrator(conversations, llm, resources),
  };
}

export function getAppContainer(): AppContainer {
  globalState.__unrestrictedAiContainer ??= createContainer();
  return globalState.__unrestrictedAiContainer;
}
```

- [ ] **Step 3: Implement exact health and conversation handlers**

`src/app/api/health/route.ts`:

```ts
export const runtime = 'nodejs';

export function GET() {
  return Response.json({ status: 'ok', app: 'Unrestricted AI', runtime: 'local' });
}
```

`src/app/api/conversations/route.ts`:

```ts
import { getAppContainer } from '@/server/app-container';

export const runtime = 'nodejs';

export function GET() {
  return Response.json(getAppContainer().conversations.listConversations());
}

export function POST() {
  return Response.json(getAppContainer().conversations.createConversation(), { status: 201 });
}
```

`src/app/api/conversations/[id]/route.ts`:

```ts
import { getAppContainer } from '@/server/app-container';

export const runtime = 'nodejs';

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const conversation = getAppContainer().conversations.getConversation(id);
  if (!conversation) return Response.json({ error: 'Conversation not found' }, { status: 404 });
  return Response.json(conversation);
}
```

- [ ] **Step 4: Implement the streaming chat handler**

`src/app/api/chat/route.ts`:

```ts
import type { ChatTransportEvent } from '@/shared/chat';
import { getAppContainer } from '@/server/app-container';
import { encodeNdjson } from '@/server/chat/ndjson';

export const runtime = 'nodejs';

interface ChatRequestBody {
  conversationId?: string;
  message: string;
}

function isChatRequestBody(value: unknown): value is ChatRequestBody {
  if (typeof value !== 'object' || value === null) return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.message === 'string' &&
    (record.conversationId === undefined || typeof record.conversationId === 'string')
  );
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!isChatRequestBody(body) || !body.message.trim()) {
    return Response.json({ error: 'A non-empty message is required' }, { status: 400 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const event of getAppContainer().chat.stream({
          conversationId: body.conversationId,
          text: body.message,
          signal: request.signal,
        })) {
          controller.enqueue(encoder.encode(encodeNdjson(event)));
        }
      } catch (error: unknown) {
        if (!(error instanceof DOMException && error.name === 'AbortError') && !request.signal.aborted) {
          console.error(error);
          const safeError: ChatTransportEvent = { type: 'error', message: 'Generation failed' };
          controller.enqueue(encoder.encode(encodeNdjson(safeError)));
        }
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'application/x-ndjson; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
```

- [ ] **Step 5: Verify routes and commit**

```bash
npm test -- src/server/chat/ndjson.test.ts
npm run typecheck
npm run build
npm run dev
```

In a second terminal:

```bash
curl http://127.0.0.1:3000/api/health
```

Expected body contains `"status":"ok"`. Stop the dev process, then:

```bash
git add src/server/app-container.ts src/server/chat/ndjson.ts src/server/chat/ndjson.test.ts src/app/api
git commit -m "feat: expose local orchestration API"
```

---

### Task 7: Build the persistent chat UI and acceptance gate

**Files:** `src/features/chat/**`, modify `src/app/page.tsx`, create `README.md`.

**Produces:** one responsive Unrestricted AI interface with conversation history, streaming mock response, and stop/cancel.

- [ ] **Step 1: Write RED browser-stream parsing and composer tests**

`src/features/chat/api/chat-api.test.ts` must parse deliberately split NDJSON chunks equivalent to:

```ts
const chunks = [
  '{"type":"conversation","conversationId":"c1"}\n{"type":"del',
  'ta","text":"Hel"}\n{"type":"delta","text":"lo"}\n',
  '{"type":"done","messageId":"m2"}\n',
];
```

and assert the resulting event sequence is `conversation`, `delta`, `delta`, `done`.

`Composer.test.tsx` must assert Send is disabled for whitespace-only input and Stop is shown when `isGenerating` is true.

Run and confirm RED:

```bash
npm test -- src/features/chat
```

- [ ] **Step 2: Implement exact client API helpers and strict stream parser**

`src/features/chat/api/chat-api.ts` must export:

```ts
import type { ChatTransportEvent } from '@/shared/chat';
import type { Conversation, ConversationSummary } from '@/shared/conversation';

function isTransportEvent(value: unknown): value is ChatTransportEvent {
  if (typeof value !== 'object' || value === null) return false;
  const record = value as Record<string, unknown>;
  if (record.type === 'conversation') return typeof record.conversationId === 'string';
  if (record.type === 'delta') return typeof record.text === 'string';
  if (record.type === 'done') return typeof record.messageId === 'string';
  if (record.type === 'error') return typeof record.message === 'string';
  return false;
}

export function parseNdjsonLine(line: string): ChatTransportEvent {
  const value: unknown = JSON.parse(line);
  if (!isTransportEvent(value)) throw new Error('Invalid chat stream event');
  return value;
}

export async function listConversations(): Promise<ConversationSummary[]> {
  const response = await fetch('/api/conversations', { cache: 'no-store' });
  if (!response.ok) throw new Error('Could not load conversations');
  return (await response.json()) as ConversationSummary[];
}

export async function getConversation(id: string): Promise<Conversation> {
  const response = await fetch(`/api/conversations/${encodeURIComponent(id)}`, { cache: 'no-store' });
  if (!response.ok) throw new Error('Could not load conversation');
  return (await response.json()) as Conversation;
}

export async function* streamChat(input: {
  conversationId?: string;
  message: string;
  signal: AbortSignal;
}): AsyncIterable<ChatTransportEvent> {
  const response = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ conversationId: input.conversationId, message: input.message }),
    signal: input.signal,
  });
  if (!response.ok || !response.body) throw new Error('Could not start generation');

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      buffer += decoder.decode(value, { stream: !done });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        if (!line.trim()) continue;
        const event = parseNdjsonLine(line);
        if (event.type === 'error') throw new Error(event.message);
        yield event;
      }

      if (done) break;
    }

    if (buffer.trim()) {
      const event = parseNdjsonLine(buffer);
      if (event.type === 'error') throw new Error(event.message);
      yield event;
    }
  } finally {
    reader.releaseLock();
  }
}
```

The explicit assertions from `response.json()` are allowed only at this API mapping boundary; UI components receive already typed values and do not cast API payloads.

- [ ] **Step 3: Implement stateless MUI components**

`Composer.tsx` public contract:

```ts
export interface ComposerProps {
  isGenerating: boolean;
  onSend(text: string): void;
  onStop(): void;
}
```

Implement with local `useState('')`, MUI `TextField`, `IconButton`, `Stack`, `SendRounded`, and `StopRounded`. Trim before `onSend`; clear only after a valid send. Enter sends; Shift+Enter keeps a newline. Send is disabled when trimmed input is empty or generation is active.

`MessageList.tsx` contract:

```ts
export interface MessageListProps {
  messages: Message[];
}
```

Render only `text` parts. Use right-aligned contained surface for user messages and left-aligned transparent/low-emphasis assistant surface. Do not inspect provider IDs.

`ConversationSidebar.tsx` contract:

```ts
export interface ConversationSidebarProps {
  conversations: ConversationSummary[];
  activeId: string | null;
  onNew(): void;
  onSelect(id: string): void;
}
```

Use a `Button` for New conversation and `List`/`ListItemButton` for history. No fetching inside this component.

`ChatShell.tsx` contract:

```ts
export interface ChatShellProps {
  sidebar: React.ReactNode;
  messages: React.ReactNode;
  composer: React.ReactNode;
}
```

Use `Box`/`Stack`; desktop sidebar width 280px and hidden on `xs`/`sm`; content column fills remaining viewport. No fixed model selector in v1.

- [ ] **Step 4: Implement the stateful `ChatClient` controller**

`ChatClient.tsx` must keep these states only:

```ts
const [conversations, setConversations] = useState<ConversationSummary[]>([]);
const [activeId, setActiveId] = useState<string | null>(null);
const [messages, setMessages] = useState<Message[]>([]);
const [isGenerating, setIsGenerating] = useState(false);
const abortRef = useRef<AbortController | null>(null);
```

Required send algorithm:

```ts
async function handleSend(text: string) {
  if (isGenerating) return;
  const controller = new AbortController();
  abortRef.current = controller;
  setIsGenerating(true);

  const optimisticUserId = crypto.randomUUID();
  const optimisticAssistantId = crypto.randomUUID();
  const createdAt = new Date().toISOString();
  setMessages((current) => [
    ...current,
    { id: optimisticUserId, conversationId: activeId ?? 'pending', role: 'user', parts: [{ type: 'text', text }], createdAt },
    { id: optimisticAssistantId, conversationId: activeId ?? 'pending', role: 'assistant', parts: [{ type: 'text', text: '' }], createdAt },
  ]);

  let resolvedConversationId = activeId;
  try {
    for await (const event of streamChat({ conversationId: activeId ?? undefined, message: text, signal: controller.signal })) {
      if (event.type === 'conversation') {
        resolvedConversationId = event.conversationId;
        setActiveId(event.conversationId);
      }
      if (event.type === 'delta') {
        setMessages((current) => current.map((message) =>
          message.id === optimisticAssistantId
            ? { ...message, parts: [{ type: 'text', text: `${message.parts[0]?.type === 'text' ? message.parts[0].text : ''}${event.text}` }] }
            : message,
        ));
      }
    }

    if (resolvedConversationId) {
      const [conversation, summaries] = await Promise.all([
        getConversation(resolvedConversationId),
        listConversations(),
      ]);
      setMessages(conversation.messages);
      setConversations(summaries);
    }
  } catch (error: unknown) {
    if (!(error instanceof DOMException && error.name === 'AbortError')) console.error(error);
    if (resolvedConversationId) {
      const conversation = await getConversation(resolvedConversationId).catch(() => null);
      if (conversation) setMessages(conversation.messages);
    }
  } finally {
    abortRef.current = null;
    setIsGenerating(false);
  }
}
```

On mount, call `listConversations()`. `handleSelect(id)` loads `getConversation(id)` then sets `activeId/messages`. `handleNew()` aborts any active generation, sets `activeId` to `null`, and clears messages. `handleStop()` calls `abortRef.current?.abort()`.

Compose `ChatShell` with `ConversationSidebar`, `MessageList`, and `Composer`.

- [ ] **Step 5: Replace the page and verify UI**

`src/app/page.tsx`:

```tsx
import { ChatClient } from '@/features/chat/components/ChatClient';

export default function HomePage() {
  return <ChatClient />;
}
```

Run:

```bash
npm test -- src/features/chat
npm run typecheck
npm run lint
npm run build
npm run dev
```

Manual browser acceptance at `http://127.0.0.1:3000`:

1. send `Hello` and observe multiple streamed mock chunks;
2. create a second conversation with New conversation;
3. select the first conversation and see persisted history;
4. restart the dev server and confirm history remains;
5. send another message, press Stop during streaming, and confirm UI returns to idle without a fake persisted assistant completion.

- [ ] **Step 6: Add README and run the final milestone gate**

Create `README.md` containing:

```md
# Unrestricted AI

Private, local-first personal AI assistant. Milestone 1 uses a mock local provider so the application architecture can be tested before multi-gigabyte model downloads are introduced.

## Requirements

- Windows
- Node.js 24 LTS
- Git
- Visual Studio Code

## Setup

```bash
npm install
npm run db:migrate
npm run dev
```

Open `http://127.0.0.1:3000`.

The default local paths are `./data`, `./models`, and `./outputs`. Copy `.env.example` to `.env.local` only when custom paths are required.

Model weights, generated assets, caches, local databases, and secrets are intentionally excluded from Git.

Development for this project stays on the `main` branch only.
```

Then run the full gate:

```bash
git branch --show-current
npm test
npm run typecheck
npm run lint
npm run build
git ls-files | grep -E '(\.gguf$|\.safetensors$|\.ckpt$|\.db$|^models/|^outputs/|^uploads/|^cache/)'
```

Expected: branch output is `main`; test/typecheck/lint/build exit 0; artifact grep prints nothing.

- [ ] **Step 7: Commit**

```bash
git add src/features/chat src/app/page.tsx README.md
git commit -m "feat: complete local chat foundation"
```

Milestone 1 is complete only after the full gate above is green. Do not start the llama.cpp/Qwen integration until then.
