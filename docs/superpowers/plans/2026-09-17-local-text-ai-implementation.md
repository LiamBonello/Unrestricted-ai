# Local Text AI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the mock-only text path with a configurable, fully local `llama.cpp` runtime that streams Qwen3.5 chat with persisted conversation history while preserving the existing provider and resource-management boundaries.

**Architecture:** The browser and chat API remain provider-agnostic. `ChatOrchestrator` maps persisted messages into a text-only LLM message contract, a `LlamaCppProvider` streams from a loopback `llama-server` OpenAI-compatible endpoint, and a `LlamaCppServerManager` owns the native Windows process. `ResourceManager` grows a resident-worker lifecycle so later image/video jobs can unload the LLM before claiming the 8 GB GPU. Normal application startup is offline-only; downloading model weights is an explicit user setup action.

**Tech Stack:** Existing Node.js 24 / Next.js 16.3.3 / TypeScript strict application, native Windows `llama.cpp` server, Qwen3.5 GGUF models, built-in `fetch`, `child_process`, Vitest.

**Spec:** `docs/superpowers/specs/2026-09-17-unrestricted-ai-v1-design.md`

## Global Constraints

- Work directly on `main`; do not create feature branches, PR branches, or worktrees.
- V1 remains single-user, local-only, and binds model services to `127.0.0.1`.
- No paid AI API is introduced.
- Normal app execution must never silently download model weights.
- Model/runtime paths and hardware tuning values are configuration, not UI constants.
- Keep all model-specific mapping out of React components.
- TypeScript remains strict; do not introduce `any`.
- Preserve the existing mock provider for CI and development where no local model exists.
- The normal UI continues to say `Unrestricted AI`; model/provider names remain diagnostics/setup details.
- Coding-specific assistant functionality remains out of scope.
- Video remains text-to-video and image-to-video only; this milestone does not implement video.
- The initial hardware profile targets Intel i9-12900K, RTX 3070 Ti 8 GB, 32 GB system RAM.
- Recommended first model profile is `unsloth/Qwen3.5-9B-GGUF:Q4_K_M`; fallback is `unsloth/Qwen3.5-4B-GGUF:Q4_K_M`.
- The recommended 9B quantization is a starting profile, not a hard requirement; the profile is replaceable without UI changes.
- Initial context size is 8192 tokens to keep the 8 GB VRAM profile conservative; it remains configurable and must be benchmarked locally.
- `llama.cpp` GPU layers use `auto` by default; do not guess a fixed layer count for this machine.
- Normal runtime uses the Hugging Face cache in offline mode after explicit setup has populated it.

---

## File Structure

```text
.env.example
README.md
package.json

src/server/config/assistant.ts                   assistant/system prompt configuration
src/server/config/llm-runtime.ts                 validated provider/runtime profile
src/server/config/llm-runtime.test.ts

src/server/providers/types.ts                    history-aware LLM contract
src/server/providers/mock-llm-provider.ts        updated mock implementation
src/server/providers/mock-llm-provider.test.ts
src/server/providers/llama-cpp/sse.ts            SSE frame parser
src/server/providers/llama-cpp/sse.test.ts
src/server/providers/llama-cpp/provider.ts       OpenAI-compatible streaming adapter
src/server/providers/llama-cpp/provider.test.ts
src/server/providers/llama-cpp/server-manager.ts native process/readiness lifecycle
src/server/providers/llama-cpp/server-manager.test.ts
src/server/providers/llama-cpp/types.ts          injected process/fetch contracts

src/server/chat/to-llm-messages.ts               domain -> provider mapping
src/server/chat/to-llm-messages.test.ts
src/server/chat/chat-orchestrator.ts              sends full persisted history
src/server/chat/chat-orchestrator.test.ts

src/server/resources/resource-manager.ts          resident worker lifecycle + FIFO leases
src/server/resources/resource-manager.test.ts
src/server/app-container.ts                       mock/llama composition root

src/shared/runtime.ts                             safe diagnostics response type
src/app/api/runtime/llm/route.ts                  local diagnostics endpoint

scripts/text-ai-setup.ps1                         explicit Windows install/cache setup
scripts/text-ai-doctor.ps1                        local NVIDIA/runtime/config diagnostics
```

---

### Task 1: Make the LLM provider contract conversation-aware

**Files:**
- Modify: `src/server/providers/types.ts`
- Modify: `src/server/providers/mock-llm-provider.ts`
- Modify: `src/server/providers/mock-llm-provider.test.ts`
- Create: `src/server/config/assistant.ts`
- Create: `src/server/chat/to-llm-messages.ts`
- Create: `src/server/chat/to-llm-messages.test.ts`
- Modify: `src/server/chat/chat-orchestrator.ts`
- Modify: `src/server/chat/chat-orchestrator.test.ts`

**Interfaces:**
- Produces: `LLMMessage = { role: 'system' | 'user' | 'assistant'; content: string }`.
- Produces: `LLMStreamRequest = { messages: readonly LLMMessage[]; signal?: AbortSignal }`.
- Produces: `toLLMMessages(conversation: Conversation, systemPrompt: string): LLMMessage[]`.
- `ChatOrchestrator` gains a constructor `systemPrompt: string` dependency and sends the full persisted history after the current user message is saved.

- [ ] **Step 1: Add failing mapper tests**

Create `src/server/chat/to-llm-messages.test.ts` with tests asserting that a system message is first, user/assistant text messages retain chronological order, whitespace-only system prompts are omitted, and provider messages never expose persistence IDs.

```ts
expect(toLLMMessages(conversation, 'You are Unrestricted AI.')).toEqual([
  { role: 'system', content: 'You are Unrestricted AI.' },
  { role: 'user', content: 'Hello' },
  { role: 'assistant', content: 'Hi' },
]);
```

- [ ] **Step 2: Run focused tests and verify failure**

```bash
npm test -- src/server/chat/to-llm-messages.test.ts src/server/chat/chat-orchestrator.test.ts
```

Expected: mapper module is missing and orchestrator still calls the provider with `prompt`.

- [ ] **Step 3: Implement the history-aware provider contract and mapper**

Update `src/server/providers/types.ts`:

```ts
export type LLMRole = 'system' | 'user' | 'assistant';

export interface LLMMessage {
  role: LLMRole;
  content: string;
}

export interface LLMStreamRequest {
  messages: readonly LLMMessage[];
  signal?: AbortSignal;
}
```

Create `toLLMMessages` as the only domain-to-provider mapping layer. It must concatenate text parts for each stored message and must not reference UI state.

- [ ] **Step 4: Update mock provider and orchestrator**

The mock provider should echo the final user message from `request.messages`. `ChatOrchestrator` must persist the user message, reload the conversation, call `toLLMMessages`, then acquire the LLM resource and stream.

Default system prompt comes from `getAssistantConfig()`:

```ts
export interface AssistantConfig {
  systemPrompt: string;
}

export function getAssistantConfig(): AssistantConfig {
  return {
    systemPrompt: process.env.UNRESTRICTED_AI_SYSTEM_PROMPT?.trim()
      || 'You are Unrestricted AI, a private local AI assistant.',
  };
}
```

- [ ] **Step 5: Add a regression test for conversation history**

The second request in one conversation must give the provider the preceding user/assistant exchange plus the new user message. Abort behavior and persistence behavior from Foundation must remain unchanged.

- [ ] **Step 6: Run focused and full tests**

```bash
npm test -- src/server/chat src/server/providers/mock-llm-provider.test.ts
npm test
npm run typecheck
```

Expected: all pass.

- [ ] **Step 7: Commit**

```bash
git add src/server/providers src/server/config/assistant.ts src/server/chat
git commit -m "feat: send conversation history to LLM providers"
```

---

### Task 2: Add validated local LLM runtime configuration

**Files:**
- Create: `src/server/config/llm-runtime.ts`
- Create: `src/server/config/llm-runtime.test.ts`
- Modify: `.env.example`

**Interfaces:**
- Produces `LlmProviderMode = 'mock' | 'llama-cpp'`.
- Produces `LlamaCppRuntimeConfig` with executable, model repo/quantization, cache dir, port, context size, GPU layers, startup timeout and base URL.
- Produces `getLlmRuntimeConfig(env?: NodeJS.ProcessEnv): LlmRuntimeConfig`.

- [ ] **Step 1: Write failing configuration tests**

Cover:
- default mode is `mock` so CI never needs a model;
- `llama-cpp` mode fixes host to `127.0.0.1`;
- invalid ports, context sizes, startup timeouts and GPU-layer values throw descriptive configuration errors;
- cache path is resolved relative to `process.cwd()`;
- model source is a Hugging Face repo/quant string rather than a browser/API value.

- [ ] **Step 2: Implement strict parsing**

Use these environment keys:

```dotenv
UNRESTRICTED_AI_LLM_PROVIDER=mock
UNRESTRICTED_AI_LLAMA_SERVER_PATH=llama-server
UNRESTRICTED_AI_LLAMA_MODEL=unsloth/Qwen3.5-9B-GGUF:Q4_K_M
UNRESTRICTED_AI_LLAMA_CACHE_DIR=./models/llama-cache
UNRESTRICTED_AI_LLAMA_PORT=8091
UNRESTRICTED_AI_LLAMA_CONTEXT_SIZE=8192
UNRESTRICTED_AI_LLAMA_GPU_LAYERS=auto
UNRESTRICTED_AI_LLAMA_STARTUP_TIMEOUT_MS=120000
UNRESTRICTED_AI_SYSTEM_PROMPT=You are Unrestricted AI, a private local AI assistant.
```

`UNRESTRICTED_AI_LLAMA_GPU_LAYERS` accepts `auto`, `all`, or a non-negative integer. The host is not configurable and is always loopback.

- [ ] **Step 3: Keep normal runtime offline-only**

The resulting llama config must include `offline: true`; there is no environment switch that silently makes normal app startup download weights.

- [ ] **Step 4: Run tests**

```bash
npm test -- src/server/config/llm-runtime.test.ts
npm run typecheck
```

Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add .env.example src/server/config/llm-runtime.ts src/server/config/llm-runtime.test.ts
git commit -m "feat: add local LLM runtime configuration"
```

---

### Task 3: Extend ResourceManager with resident worker lifecycle

**Files:**
- Modify: `src/server/resources/resource-manager.ts`
- Modify: `src/server/resources/resource-manager.test.ts`

**Interfaces:**
- Produces `HeavyWorkerLifecycle = { start(): Promise<void>; stop(): Promise<void> }`.
- Produces `registerWorker(capability, worker): void`.
- Produces `getResidentCapability(): HeavyCapability | null`.
- Produces `unloadResident(): Promise<void>`.
- Existing FIFO lease semantics remain intact.

- [ ] **Step 1: Add failing lifecycle tests**

Tests must prove:
1. first `llm` lease starts the registered LLM worker once;
2. a second `llm` lease reuses the resident worker;
3. switching from `llm` to `image` stops LLM before starting image;
4. startup failure releases the queue slot and does not mark the capability resident;
5. `unloadResident()` waits until no active lease and then stops the worker.

- [ ] **Step 2: Implement resident worker state**

Maintain separate state for:

```ts
private active: HeavyCapability | null;
private resident: HeavyCapability | null;
private readonly workers = new Map<HeavyCapability, HeavyWorkerLifecycle>();
```

On capability switch, stop the resident worker, then start the requested worker, then grant the lease. A lease `release()` clears only `active`, not `resident`.

- [ ] **Step 3: Preserve failure safety**

A failed `start()` must resolve the current queue slot before throwing so later jobs cannot deadlock.

- [ ] **Step 4: Run tests**

```bash
npm test -- src/server/resources/resource-manager.test.ts
npm test
```

Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add src/server/resources/resource-manager.ts src/server/resources/resource-manager.test.ts
git commit -m "feat: manage resident heavyweight workers"
```

---

### Task 4: Add native llama-server process management

**Files:**
- Create: `src/server/providers/llama-cpp/types.ts`
- Create: `src/server/providers/llama-cpp/server-manager.ts`
- Create: `src/server/providers/llama-cpp/server-manager.test.ts`

**Interfaces:**
- Produces `buildLlamaServerArgs(config): string[]`.
- Produces `LlamaCppServerManager` implementing `HeavyWorkerLifecycle`.
- Produces safe status: `'stopped' | 'starting' | 'ready' | 'failed'`.
- Constructor accepts injectable process spawn, fetch, clock/sleep adapters for deterministic tests.

- [ ] **Step 1: Write failing argument tests**

For the default 9B profile, assert an argument array equivalent to:

```text
--hf-repo unsloth/Qwen3.5-9B-GGUF:Q4_K_M
--offline
--no-mmproj
--host 127.0.0.1
--port 8091
--ctx-size 8192
--n-gpu-layers auto
--parallel 1
--flash-attn auto
```

No shell command string may be constructed; executable and args must remain separate.

- [ ] **Step 2: Write failing lifecycle tests**

Use a fake child process and fake fetch to prove:
- HTTP 503 from `/health` means loading, not failure;
- HTTP 200 `{ "status": "ok" }` marks ready;
- process exit before readiness fails startup;
- startup timeout kills the child and fails;
- repeated `start()` while ready does not spawn twice;
- `stop()` terminates the owned process and returns to `stopped`.

- [ ] **Step 3: Implement process spawning**

Use `spawn(config.executablePath, args, { shell: false, windowsHide: true, env: { ...process.env, LLAMA_CACHE: config.cacheDir } })`.

Never use `exec`, `shell: true`, or user-controlled command concatenation.

- [ ] **Step 4: Implement readiness polling**

Poll `${config.baseUrl}/health`. Treat connection errors and 503 as transient until `startupTimeoutMs`. Only a 200 response with JSON `{ status: 'ok' }` is ready.

- [ ] **Step 5: Run tests**

```bash
npm test -- src/server/providers/llama-cpp/server-manager.test.ts
npm run typecheck
npm run lint
```

Expected: pass without starting a real process in CI.

- [ ] **Step 6: Commit**

```bash
git add src/server/providers/llama-cpp
git commit -m "feat: manage local llama.cpp server process"
```

---

### Task 5: Implement robust llama.cpp SSE streaming provider

**Files:**
- Create: `src/server/providers/llama-cpp/sse.ts`
- Create: `src/server/providers/llama-cpp/sse.test.ts`
- Create: `src/server/providers/llama-cpp/provider.ts`
- Create: `src/server/providers/llama-cpp/provider.test.ts`

**Interfaces:**
- Produces `parseSseDataLines(responseBody, signal): AsyncIterable<string>` returning only `data:` payloads.
- Produces `LlamaCppProvider implements LLMProvider`.
- Calls `POST /v1/chat/completions` with `{ model: 'local', messages, stream: true }`.

- [ ] **Step 1: Write SSE parser tests**

Cover arbitrary byte chunk boundaries, CRLF and LF delimiters, multiple `data:` events in one chunk, blank event separators, `[DONE]`, and abort propagation.

- [ ] **Step 2: Write provider tests**

A successful stream shaped like:

```text
data: {"choices":[{"delta":{"content":"Hello"}}]}

data: {"choices":[{"delta":{"content":" world"}}]}

data: [DONE]

```

must yield two `text-delta` events and one `done` event.

Also test:
- `reasoning_content` is not surfaced as user-visible chain-of-thought;
- an HTTP non-2xx response becomes a provider error;
- malformed JSON becomes a provider error rather than crashing the process;
- request `AbortSignal` is passed to fetch.

- [ ] **Step 3: Implement SSE parsing without an OpenAI SDK**

Use `ReadableStreamDefaultReader<Uint8Array>` + `TextDecoder`; keep a string buffer across arbitrary chunks. This avoids a cloud/provider dependency.

- [ ] **Step 4: Implement the provider request**

Send only roles/content from the provider contract. Do not send persistence IDs, model filesystem paths, UI objects, or API keys.

- [ ] **Step 5: Run tests**

```bash
npm test -- src/server/providers/llama-cpp
npm test
npm run typecheck
```

Expected: pass.

- [ ] **Step 6: Commit**

```bash
git add src/server/providers/llama-cpp
git commit -m "feat: stream chat from local llama.cpp"
```

---

### Task 6: Compose mock and llama.cpp modes and expose safe diagnostics

**Files:**
- Modify: `src/server/app-container.ts`
- Create: `src/shared/runtime.ts`
- Create: `src/app/api/runtime/llm/route.ts`
- Create: `src/server/app-container.test.ts`

**Interfaces:**
- `AppContainer` adds `llmRuntime` with a safe `getStatus()` method.
- `GET /api/runtime/llm` returns mode, configured flag, worker status, resident capability, model label and base URL; it never returns full filesystem paths or environment variables.

- [ ] **Step 1: Write composition tests**

Inject runtime config into a `createAppContainer(config, dependencies)` factory and prove:
- `mock` config composes `MockLLMProvider` and no resident worker lifecycle;
- `llama-cpp` config composes `LlamaCppProvider`, registers the server manager for `llm`, and keeps the server stopped until the first LLM lease;
- assistant system prompt is passed to `ChatOrchestrator` in both modes.

- [ ] **Step 2: Refactor composition root for testability**

Keep `getAppContainer()` as the production singleton, but export a dependency-injectable factory used by tests.

- [ ] **Step 3: Add diagnostics endpoint**

Example safe response:

```json
{
  "mode": "llama-cpp",
  "configured": true,
  "status": "ready",
  "residentCapability": "llm",
  "model": "unsloth/Qwen3.5-9B-GGUF:Q4_K_M",
  "baseUrl": "http://127.0.0.1:8091"
}
```

No UI changes are required in this milestone.

- [ ] **Step 4: Run tests and build**

```bash
npm test
npm run typecheck
npm run lint
npm run build
```

Expected: all pass in mock mode with no local model installed.

- [ ] **Step 5: Commit**

```bash
git add src/server/app-container.ts src/server/app-container.test.ts src/shared/runtime.ts src/app/api/runtime/llm
git commit -m "feat: compose configurable local LLM runtime"
```

---

### Task 7: Add explicit Windows setup and diagnostics scripts

**Files:**
- Create: `scripts/text-ai-setup.ps1`
- Create: `scripts/text-ai-doctor.ps1`
- Modify: `package.json`
- Modify: `README.md`

**Interfaces:**
- `text-ai-setup.ps1` is the only workflow that intentionally allows the initial model download.
- `text-ai-doctor.ps1` checks Windows prerequisites without modifying the machine.

- [ ] **Step 1: Implement the doctor script**

It must check and report:
1. Windows PowerShell environment;
2. `nvidia-smi` is available and lists an NVIDIA GPU;
3. `llama-server` is available on PATH or at `UNRESTRICTED_AI_LLAMA_SERVER_PATH`;
4. configured model cache directory is writable;
5. Node major version is 24;
6. `.env.local` exists when llama mode is selected.

The script exits non-zero if a required check fails.

- [ ] **Step 2: Implement explicit setup script**

The script accepts parameters with defaults:

```powershell
param(
  [string]$Model = 'unsloth/Qwen3.5-9B-GGUF:Q4_K_M',
  [string]$CacheDir = '.\models\llama-cache',
  [int]$Port = 8091,
  [int]$ContextSize = 8192
)
```

If `llama-server` is absent, print the official Windows command `winget install llama.cpp` and exit; do not silently install software. If present, explicitly ask the local command to populate the cache by starting:

```text
llama-server --hf-repo <Model> --no-mmproj --host 127.0.0.1 --port <Port> --ctx-size <ContextSize> --n-gpu-layers auto --parallel 1 --flash-attn auto
```

with `LLAMA_CACHE=<CacheDir>` and without `--offline`. The script polls `/health`, writes a `.env.local` template only after the model is ready, then stops the setup server. It must not commit or print secrets.

- [ ] **Step 3: Add npm helpers**

```json
"llm:doctor": "powershell -ExecutionPolicy Bypass -File scripts/text-ai-doctor.ps1",
"llm:setup": "powershell -ExecutionPolicy Bypass -File scripts/text-ai-setup.ps1"
```

- [ ] **Step 4: Document 9B and fallback profiles**

README text must state:
- Qwen3.5-9B Q4_K_M is the first profile for the RTX 3070 Ti 8 GB;
- Qwen3.5-4B Q4_K_M is the fallback if 9B latency/memory is unsatisfactory;
- `8192` context and GPU `auto` are conservative starting values, not model limits;
- model weights stay local and are ignored by Git;
- normal app mode uses `--offline`, so a missing model fails instead of being silently downloaded.

- [ ] **Step 5: Commit**

```bash
git add scripts package.json README.md
git commit -m "feat: add Windows local LLM setup workflow"
```

---

### Task 8: CI verification and local hardware smoke-test contract

**Files:**
- Modify: `README.md` only if verification reveals missing instructions.

**Interfaces:**
- CI verifies all provider/config/process code without downloading weights.
- Local smoke test verifies the real RTX 3070 Ti path and records the profile used.

- [ ] **Step 1: Run fresh CI-equivalent verification**

```bash
npm test
npm run typecheck
npm run lint
npm run build
```

Expected: all pass with `UNRESTRICTED_AI_LLM_PROVIDER=mock`.

- [ ] **Step 2: Run the explicit local setup on the user's Windows PC**

```powershell
npm run llm:doctor
npm run llm:setup
```

Then start the app:

```powershell
npm run dev
```

- [ ] **Step 3: Verify real local inference**

Check:

```text
GET http://127.0.0.1:3000/api/runtime/llm
```

must show `mode: llama-cpp` and, after the first prompt, `status: ready`.

In the UI send at least two turns where the second turn depends on the first. Acceptance requires streamed text and conversation history preservation after page reload.

- [ ] **Step 4: Verify offline behavior**

After setup, disconnect network access or otherwise prevent external model access and restart the app. The same cached model must start and answer because normal runtime uses `--offline`.

- [ ] **Step 5: Record hardware profile in local notes only**

Record successful context size, observed VRAM usage, response latency and whether 9B or 4B was used. Do not commit machine-specific paths or local benchmark output.

- [ ] **Step 6: Milestone acceptance**

Milestone 2 is complete only when:
- CI is green;
- real `llama.cpp` local inference streams through the Unrestricted AI UI;
- a multi-turn conversation uses history;
- normal runtime works from cache without paid APIs/network model inference;
- stop/cancel still releases the LLM resource lease.
