# Local Image Generation and Editing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add fully local image generation and image editing to Unrestricted AI using a loopback ComfyUI runtime, persisted image assets, GPU-safe worker switching, and a permissive adult-content profile suitable for lawful 18+ Rule 34-style generation.

**Architecture:** The browser remains model-agnostic. A new `ImageOrchestrator` persists the user request, acquires the existing `image` GPU lease, calls an `ImageProvider`, stores the generated asset under the app-controlled outputs directory, then persists an assistant image message. ComfyUI runs as a resident heavyweight worker on `127.0.0.1`; the existing `ResourceManager` unloads llama.cpp before ComfyUI starts and unloads ComfyUI before text inference resumes. General/editing workflows target FLUX.2 Klein 4B where the RTX 3070 Ti profile proves usable; a separate configurable SDXL-family adult profile handles lawful explicit adult / Rule 34-style text-to-image without sanitizing the user's prompt.

**Tech Stack:** Existing Node.js 24 / Next.js 16.3.3 / TypeScript strict / MUI 9 application, native Windows ComfyUI, built-in `fetch` and Node WebSocket client, SQLite via `node:sqlite`, Vitest.

**Spec:** `docs/superpowers/specs/2026-09-17-unrestricted-ai-v1-design.md`

## Global Constraints

- Work directly on `main`; do not create feature branches, PR branches, or worktrees.
- V1 remains single-user, local-only, and binds model services to `127.0.0.1`.
- No paid AI API is introduced.
- Normal app execution must never silently download model weights or ComfyUI.
- Model/runtime paths and hardware tuning values are configuration, not UI constants.
- Keep all model/workflow-specific mapping out of React components.
- TypeScript remains strict; do not introduce `any`.
- Preserve mock providers so CI never requires CUDA, ComfyUI, or model weights.
- Model names remain diagnostics/setup details; the product UI continues to say `Unrestricted AI`.
- Generated assets and model weights are never committed.
- Adult explicit content is allowed by the product policy for clearly adult, consensual, lawful subjects, including fictional/animated Rule 34-style generation.
- Sexual content involving minors or age-ambiguous subjects is not allowed.
- Non-consensual intimate imagery is not allowed. Explicit edits of user-uploaded images require a local consent confirmation flag.
- The media policy is a product/orchestrator layer and must not be embedded in ComfyUI workflow code.
- Do not send prompts or images to third-party moderation services.
- FLUX.2 Klein 4B is a benchmark candidate, not an assumption that it fits natively in 8 GB VRAM. Current upstream guidance is roughly 13 GB without constrained-memory offload; the local benchmark must prove the DynamicVRAM profile on the RTX 3070 Ti.
- The adult checkpoint is configurable. The first local test profile may use a Pony/Illustrious-family SDXL checkpoint, but no license-restricted checkpoint is silently downloaded at runtime.

---

## File Structure

```text
.env.example
README.md
package.json
.gitignore

src/shared/conversation.ts
src/shared/image.ts
src/shared/runtime.ts

src/server/config/image-runtime.ts
src/server/config/image-runtime.test.ts
src/server/policy/media-policy.ts
src/server/policy/media-policy.test.ts

src/server/db/migrations/0002-image-assets.ts
src/server/assets/asset-repository.ts
src/server/assets/asset-repository.test.ts
src/server/assets/asset-service.ts

src/server/providers/types.ts
src/server/providers/mock-image-provider.ts
src/server/providers/mock-image-provider.test.ts
src/server/providers/comfyui/types.ts
src/server/providers/comfyui/client.ts
src/server/providers/comfyui/client.test.ts
src/server/providers/comfyui/server-manager.ts
src/server/providers/comfyui/server-manager.test.ts
src/server/providers/comfyui/workflows/sdxl.ts
src/server/providers/comfyui/workflows/sdxl.test.ts
src/server/providers/comfyui/workflows/flux2-klein.ts
src/server/providers/comfyui/workflows/flux2-klein.test.ts
src/server/providers/comfyui/provider.ts
src/server/providers/comfyui/provider.test.ts

src/server/images/image-orchestrator.ts
src/server/images/image-orchestrator.test.ts

src/app/api/images/generate/route.ts
src/app/api/uploads/images/route.ts
src/app/api/assets/[id]/route.ts
src/app/api/runtime/image/route.ts

src/features/chat/api/image-api.ts
src/features/chat/components/Composer.tsx
src/features/chat/components/MessageList.tsx
src/features/chat/components/ChatClient.tsx

scripts/image-ai-doctor.ps1
scripts/image-ai-setup.ps1
scripts/text-ai-setup.ps1
scripts/image-ai-workflow.test.ts
```

---

### Task 0: Make the existing llama cache portable

**Files:**
- Modify: `scripts/text-ai-setup.ps1`
- Modify: `scripts/text-ai-workflow.test.ts`
- Modify: `README.md`

**Interfaces:**
- `text-ai-setup.ps1` still resolves the absolute cache path for the setup process itself.
- When the requested cache directory is within the repository, `.env.local` stores `UNRESTRICTED_AI_LLAMA_CACHE_DIR=./models/llama-cache` rather than the machine-specific absolute path.

- [ ] **Step 1: Add a failing workflow contract test**

Add a test asserting that the setup script computes a portable dotenv value separately from the absolute runtime setup path and that README documents relative local paths.

- [ ] **Step 2: Verify the focused test fails**

Run `npm test -- scripts/text-ai-workflow.test.ts`.

Expected: the new portability assertion fails because setup currently writes `$cacheFullPath` into `.env.local`.

- [ ] **Step 3: Implement the portable dotenv value**

Use the original `$CacheDir` for dotenv when it is relative:

```powershell
$cachePathForEnv = if ([System.IO.Path]::IsPathRooted($CacheDir)) {
  $cacheFullPath
} else {
  $CacheDir.Replace('\\', '/')
}
```

Write `UNRESTRICTED_AI_LLAMA_CACHE_DIR="$cachePathForEnv"`.

- [ ] **Step 4: Run focused verification**

Run:
```bash
npm test -- scripts/text-ai-workflow.test.ts
npm run typecheck
```

Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add scripts/text-ai-setup.ps1 scripts/text-ai-workflow.test.ts README.md
git commit -m "fix: keep local model cache paths portable"
```

---

### Task 1: Extend the conversation model with persisted image assets

**Files:**
- Modify: `src/shared/conversation.ts`
- Create: `src/shared/image.ts`
- Create: `src/server/db/migrations/0002-image-assets.ts`
- Modify: `src/server/db/migrate.ts`
- Create: `src/server/assets/asset-repository.ts`
- Create: `src/server/assets/asset-repository.test.ts`
- Create: `src/server/assets/asset-service.ts`
- Modify: `src/server/conversations/repository.ts`
- Modify: `src/server/conversations/service.ts`
- Modify existing conversation tests.

**Interfaces:**
- Produces:
```ts
export type ImageAssetSource = 'upload' | 'generated';

export interface ImageAsset {
  id: string;
  conversationId: string;
  source: ImageAssetSource;
  storagePath: string;
  mimeType: 'image/png' | 'image/jpeg' | 'image/webp';
  width: number | null;
  height: number | null;
  createdAt: string;
}

export interface ImagePart {
  type: 'image';
  assetId: string;
  alt: string;
}

export type MessagePart = TextPart | ImagePart;
```
- `AssetService.saveGeneratedImage(...)` writes bytes beneath `outputs/images` using generated filenames.
- `AssetService.saveUpload(...)` writes beneath `uploads/images`.
- Database paths are relative to their configured data roots; API responses never expose raw local filesystem paths.

- [ ] **Step 1: Write failing migration and repository tests**

Tests must prove:
1. migration 2 creates `assets`;
2. an image message round-trips through `parts_json`;
3. asset metadata round-trips;
4. deleting a conversation cascades asset metadata;
5. only supported image MIME types are accepted.

- [ ] **Step 2: Verify tests fail**

Run:
```bash
npm test -- src/server/assets src/server/db src/server/conversations
```

Expected: missing image part/asset modules and migration.

- [ ] **Step 3: Add migration 2**

Create:
```ts
export const imageAssetsMigration: Migration = {
  version: 2,
  name: 'image assets',
  sql: `
    CREATE TABLE assets (
      id TEXT PRIMARY KEY,
      conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
      source TEXT NOT NULL CHECK (source IN ('upload', 'generated')),
      storage_path TEXT NOT NULL,
      mime_type TEXT NOT NULL CHECK (mime_type IN ('image/png', 'image/jpeg', 'image/webp')),
      width INTEGER,
      height INTEGER,
      created_at TEXT NOT NULL
    );
    CREATE INDEX assets_conversation_created_idx
      ON assets(conversation_id, created_at, id);
  `,
};
```

Register it after migration 1.

- [ ] **Step 4: Extend message parsing without weakening types**

Update `parseParts` so each element must be either a valid `TextPart` or valid `ImagePart`; invalid stored JSON still throws.

- [ ] **Step 5: Implement asset storage/repository services**

All filenames are generated from UUIDs. Never concatenate an uploaded filename into a filesystem path.

- [ ] **Step 6: Run focused and full verification**

```bash
npm test -- src/server/assets src/server/db src/server/conversations
npm test
npm run typecheck
```

Expected: pass.

- [ ] **Step 7: Commit**

```bash
git add src/shared src/server/db src/server/assets src/server/conversations
git commit -m "feat: persist image assets in conversations"
```

---

### Task 2: Add explicit media policy and image runtime configuration

**Files:**
- Create: `src/server/policy/media-policy.ts`
- Create: `src/server/policy/media-policy.test.ts`
- Create: `src/server/config/image-runtime.ts`
- Create: `src/server/config/image-runtime.test.ts`
- Modify: `.env.example`

**Interfaces:**
- Produces:
```ts
export type ImageContentMode = 'general' | 'adult-explicit';

export interface MediaPolicyRequest {
  prompt: string;
  hasUploadedInput: boolean;
  consentConfirmed?: boolean;
}

export interface MediaPolicyDecision {
  contentMode: ImageContentMode;
  normalizedPrompt: string;
}

export function enforceMediaPolicy(request: MediaPolicyRequest): MediaPolicyDecision;
```
- The policy does not rewrite or euphemize allowed adult prompts.
- It classifies `rule 34`, `r34`, `nsfw`, `rating_explicit`, `explicit sexual`, and clearly sexual/nudity wording as `adult-explicit`.
- If adult-explicit text contains a numeric age below 18 or clear underage terms (`minor`, `underage`, `child`, `preteen`, `young teen`), it throws `MediaPolicyError('Sexual content involving minors is not allowed')`.
- Adult-explicit edits with an uploaded input require `consentConfirmed === true`; otherwise throw `MediaPolicyError('Explicit edits of uploaded people require consent confirmation')`.
- Produces:
```ts
export type ImageRuntimeMode = 'mock' | 'comfyui';

export interface ComfyUiRuntimeConfig {
  mode: 'comfyui';
  rootDir: string;
  pythonPath: string;
  mainPath: string;
  host: '127.0.0.1';
  port: number;
  startupTimeoutMs: number;
  outputsDir: string;
  uploadsDir: string;
  generalProfile: 'flux2-klein-4b-fp8';
  adultCheckpoint: string | null;
}
```

- [ ] **Step 1: Write policy tests**

Cover lawful general prompts, lawful adult Rule 34 prompts, prompt preservation, underage hard blocks, and consent confirmation for uploaded explicit edits.

- [ ] **Step 2: Write configuration tests**

Default is `mock`; ComfyUI mode fixes host to loopback; paths resolve from `process.cwd()`; invalid port/timeouts throw; adult checkpoint may be absent without breaking general image mode.

- [ ] **Step 3: Verify failure**

Run:
```bash
npm test -- src/server/policy/media-policy.test.ts src/server/config/image-runtime.test.ts
```

Expected: modules missing.

- [ ] **Step 4: Implement policy and configuration**

Add environment keys:
```dotenv
UNRESTRICTED_AI_IMAGE_PROVIDER=mock
UNRESTRICTED_AI_COMFYUI_ROOT=./runtime/ComfyUI_windows_portable
UNRESTRICTED_AI_COMFYUI_PORT=8188
UNRESTRICTED_AI_COMFYUI_STARTUP_TIMEOUT_MS=180000
UNRESTRICTED_AI_IMAGE_GENERAL_PROFILE=flux2-klein-4b-fp8
UNRESTRICTED_AI_IMAGE_ADULT_CHECKPOINT=
```

- [ ] **Step 5: Run verification**

```bash
npm test -- src/server/policy src/server/config/image-runtime.test.ts
npm run typecheck
```

Expected: pass.

- [ ] **Step 6: Commit**

```bash
git add .env.example src/server/policy src/server/config/image-runtime*
git commit -m "feat: add permissive local image policy and runtime config"
```

---

### Task 3: Add ComfyUI process lifecycle and safe diagnostics

**Files:**
- Create: `src/server/providers/comfyui/types.ts`
- Create: `src/server/providers/comfyui/server-manager.ts`
- Create: `src/server/providers/comfyui/server-manager.test.ts`
- Modify: `src/shared/runtime.ts`
- Create: `src/app/api/runtime/image/route.ts`
- Modify: `src/server/app-container.ts`
- Modify: `src/server/app-container.test.ts`

**Interfaces:**
- `ComfyUiServerManager implements HeavyWorkerLifecycle`.
- Safe status: `'stopped' | 'starting' | 'ready' | 'failed'`.
- It starts embedded Python with arguments equivalent to:
```text
-s <ComfyUI/main.py>
--windows-standalone-build
--listen 127.0.0.1
--port 8188
--enable-dynamic-vram
--vram-headroom 0.5
```
- The executable and args remain separate; never use `shell: true`.
- Readiness polls `GET /system_stats`.
- `GET /api/runtime/image` returns only mode/configured/status/residentCapability/profile/baseUrl, never local paths.

- [ ] **Step 1: Write failing argument/lifecycle tests**

Prove loopback binding, DynamicVRAM, readiness polling, startup timeout, early exit, idempotent start and stop.

- [ ] **Step 2: Verify failure**

Run `npm test -- src/server/providers/comfyui/server-manager.test.ts src/server/app-container.test.ts`.

- [ ] **Step 3: Implement the process manager**

Use `spawn(config.pythonPath, args, { shell: false, windowsHide: true, cwd: config.rootDir })`.

- [ ] **Step 4: Register the image worker in app composition**

Mock image mode registers no worker. ComfyUI mode registers `resources.registerWorker('image', manager)`. This reuses the existing GPU switch logic: first image lease stops resident llama.cpp before ComfyUI starts.

- [ ] **Step 5: Add diagnostics endpoint tests**

Assert the response does not contain `process.cwd()`, `pythonPath`, or `rootDir`.

- [ ] **Step 6: Run full verification**

```bash
npm test
npm run typecheck
npm run lint
```

Expected: pass.

- [ ] **Step 7: Commit**

```bash
git add src/server/providers/comfyui src/server/app-container* src/shared/runtime.ts src/app/api/runtime/image
git commit -m "feat: manage local ComfyUI runtime"
```

---

### Task 4: Implement ComfyUI API client, workflows and cancellation

**Files:**
- Create: `src/server/providers/comfyui/client.ts`
- Create: `src/server/providers/comfyui/client.test.ts`
- Create: `src/server/providers/comfyui/workflows/sdxl.ts`
- Create: `src/server/providers/comfyui/workflows/sdxl.test.ts`
- Create: `src/server/providers/comfyui/workflows/flux2-klein.ts`
- Create: `src/server/providers/comfyui/workflows/flux2-klein.test.ts`

**Interfaces:**
- Produces:
```ts
export interface ComfyImageJob {
  promptId: string;
}

export interface ComfyImageOutput {
  bytes: Uint8Array;
  mimeType: 'image/png' | 'image/jpeg' | 'image/webp';
}

export class ComfyUiClient {
  queue(workflow: ComfyWorkflow, clientId: string, promptId: string): Promise<ComfyImageJob>;
  uploadImage(bytes: Uint8Array, filename: string, mimeType: string): Promise<string>;
  waitForImage(promptId: string, signal?: AbortSignal): Promise<ComfyImageOutput>;
  cancel(promptId: string): Promise<void>;
}
```
- Queue uses `POST /prompt`.
- Uploaded edit inputs use `POST /upload/image`.
- Completion uses `GET /history/{prompt_id}` polling in the first implementation; output bytes are fetched through `GET /view`.
- Abort invokes `POST /api/jobs/{prompt_id}/cancel` and then throws `AbortError`.
- No external SDK or cloud API is introduced.

SDXL text-to-image API workflow uses only core nodes:
```text
CheckpointLoaderSimple
CLIPTextEncode (positive)
CLIPTextEncode (negative)
EmptyLatentImage
KSampler
VAEDecode
SaveImage
```

SDXL edit workflow replaces `EmptyLatentImage` with:
```text
LoadImage -> VAEEncode -> KSampler(denoise < 1)
```

FLUX.2 Klein workflows are derived from Comfy-Org's official `image_flux2_klein_text_to_image` and `image_flux2_klein_image_edit_4b_distilled` templates and use only core nodes. Workflow mapping functions take model filenames, prompt, seed, width/height and uploaded input filename; React code never touches node IDs.

- [ ] **Step 1: Write client tests**

Mock fetch and prove queue payload, history polling, output retrieval, upload multipart request, HTTP failures, malformed responses and cancellation.

- [ ] **Step 2: Write workflow mapping tests**

Prove prompt/model/seed/size values are injected, no local filesystem path is present in submitted workflow JSON, and adult SDXL prompts are passed unchanged.

- [ ] **Step 3: Verify failure**

Run `npm test -- src/server/providers/comfyui`.

- [ ] **Step 4: Implement minimal client and workflow builders**

Keep network parsing defensive with `unknown` -> type guards; do not cast arbitrary responses directly to domain types.

- [ ] **Step 5: Run verification**

```bash
npm test -- src/server/providers/comfyui
npm run typecheck
```

Expected: pass.

- [ ] **Step 6: Commit**

```bash
git add src/server/providers/comfyui
git commit -m "feat: execute local ComfyUI image workflows"
```

---

### Task 5: Implement provider/orchestrator and image API

**Files:**
- Modify: `src/server/providers/types.ts`
- Create: `src/server/providers/mock-image-provider.ts`
- Create: `src/server/providers/mock-image-provider.test.ts`
- Create: `src/server/providers/comfyui/provider.ts`
- Create: `src/server/providers/comfyui/provider.test.ts`
- Create: `src/server/images/image-orchestrator.ts`
- Create: `src/server/images/image-orchestrator.test.ts`
- Modify: `src/server/app-container.ts`
- Create: `src/app/api/images/generate/route.ts`
- Create: `src/app/api/uploads/images/route.ts`
- Create: `src/app/api/assets/[id]/route.ts`

**Interfaces:**
- Replace the placeholder image provider request with:
```ts
export interface ImageGenerationRequest {
  prompt: string;
  contentMode: 'general' | 'adult-explicit';
  width: number;
  height: number;
  seed: number;
  input?: {
    bytes: Uint8Array;
    mimeType: 'image/png' | 'image/jpeg' | 'image/webp';
  };
  signal?: AbortSignal;
}

export interface ImageGenerationResult {
  bytes: Uint8Array;
  mimeType: 'image/png' | 'image/jpeg' | 'image/webp';
}

export interface ImageProvider {
  readonly id: string;
  generate(request: ImageGenerationRequest): Promise<ImageGenerationResult>;
}
```
- General text/image edit uses FLUX.2 Klein profile.
- `adult-explicit` text-to-image requires configured SDXL adult checkpoint and never silently falls back to a censored hosted service.
- Adult-explicit edits of uploaded images are admitted only after `enforceMediaPolicy` receives `consentConfirmed: true`.
- `ImageOrchestrator.generate` persists user request, acquires `resources.acquire('image')`, calls provider, stores output, persists assistant image part, releases lease in `finally`.

- [ ] **Step 1: Write provider routing tests**

General generation selects FLUX workflow; adult Rule 34 generation selects configured SDXL workflow; missing adult checkpoint returns a setup error rather than rewriting the prompt or using FLUX.

- [ ] **Step 2: Write orchestrator tests**

Prove user message persistence, output asset persistence, assistant image part persistence, policy errors before GPU acquisition, cancellation releases the image lease, and switching from an already-resident LLM stops LLM before image starts.

- [ ] **Step 3: Verify failure**

Run `npm test -- src/server/images src/server/providers/mock-image-provider.test.ts src/server/providers/comfyui/provider.test.ts`.

- [ ] **Step 4: Implement provider and orchestrator**

No model selection logic is placed in the UI.

- [ ] **Step 5: Add API route tests**

`POST /api/images/generate` accepts JSON:
```json
{
  "conversationId": "optional",
  "prompt": "Generate an adult fictional character...",
  "inputAssetId": "optional",
  "consentConfirmed": false
}
```

`POST /api/uploads/images` accepts one multipart `image` file and returns its asset identifier. `GET /api/assets/:id` streams the stored asset with the recorded MIME type.

- [ ] **Step 6: Run full verification**

```bash
npm test
npm run typecheck
npm run lint
npm run build
```

Expected: pass in mock image mode with no ComfyUI installed.

- [ ] **Step 7: Commit**

```bash
git add src/server src/app/api
git commit -m "feat: generate and edit images in conversations"
```

---

### Task 6: Add image/attachment UI in the existing chat

**Files:**
- Create: `src/features/chat/api/image-api.ts`
- Modify: `src/features/chat/components/Composer.tsx`
- Modify: `src/features/chat/components/MessageList.tsx`
- Modify: `src/features/chat/components/ChatClient.tsx`
- Add/update component tests.

**Interfaces:**
- Composer local state:
```ts
type ComposerMode = 'chat' | 'image';
```
- Image mode is a product intent, not a model selector.
- One image attachment is allowed initially.
- User can remove the attachment without triggering any parent card/action.
- If an explicit edit is detected with an uploaded image, show a local checkbox:
  `I confirm all depicted people are adults and I have consent for this intimate edit.`
- Generated image messages render `/api/assets/{assetId}`.
- Stop button aborts both text and image requests.

- [ ] **Step 1: Add failing Composer tests**

Cover image-mode toggle, file selection/removal, consent checkbox only when needed, and event isolation.

- [ ] **Step 2: Add failing MessageList test**

An image part renders an image element with the app asset URL and alt text while text-only messages remain unchanged.

- [ ] **Step 3: Verify failure**

Run `npm test -- src/features/chat`.

- [ ] **Step 4: Implement API helper and UI state**

Use existing MUI patterns (`Stack`, `Box`, `Typography`, `IconButton`, `sx`) and local `useState`. Do not add model names or workflow settings to the UI.

- [ ] **Step 5: Run verification**

```bash
npm test -- src/features/chat
npm run typecheck
npm run lint
npm run build
```

Expected: pass.

- [ ] **Step 6: Commit**

```bash
git add src/features/chat
git commit -m "feat: add local image generation to chat UI"
```

---

### Task 7: Add explicit Windows image setup/doctor workflow

**Files:**
- Create: `scripts/image-ai-doctor.ps1`
- Create: `scripts/image-ai-setup.ps1`
- Create: `scripts/image-ai-workflow.test.ts`
- Modify: `package.json`
- Modify: `.gitignore`
- Modify: `README.md`

**Interfaces:**
- `image-ai-doctor.ps1` is read-only and checks Windows, NVIDIA GPU, configured ComfyUI root, embedded Python, model directories/files, writable output/upload dirs, and Node 24.
- `image-ai-setup.ps1` is the only workflow allowed to intentionally download/install ComfyUI/model files.
- Default runtime root is relative:
  `./runtime/ComfyUI_windows_portable`.
- Setup uses the official ComfyUI Windows portable NVIDIA package.
- It writes relative paths to `.env.local` wherever the target lives under the repository.
- General profile files are the official FLUX.2 Klein 4B FP8 / text encoder / VAE files required by the official ComfyUI template.
- Adult profile is opt-in:
```powershell
powershell -ExecutionPolicy Bypass -File scripts/image-ai-setup.ps1 -AdultCheckpointPath "C:\path\to\adult-checkpoint.safetensors"
```
The setup copies or links the explicitly supplied local checkpoint into ComfyUI's checkpoint directory and records only the filename in `.env.local`. It does not silently choose or download a license-restricted adult checkpoint.

- [ ] **Step 1: Add static contract tests**

Prove setup binds only loopback, uses relative dotenv paths, never enables cloud endpoints, and doctor never mutates the machine.

- [ ] **Step 2: Implement doctor**

Required checks fail non-zero; missing adult checkpoint is a warning unless the user requests adult-explicit generation.

- [ ] **Step 3: Implement explicit setup**

Download/extract the official portable runtime only when the user runs setup. Download the official FLUX files with explicit progress. Never run model downloads during `npm run dev`.

- [ ] **Step 4: Add npm scripts**

```json
"image:doctor": "powershell -ExecutionPolicy Bypass -File scripts/image-ai-doctor.ps1",
"image:setup": "powershell -ExecutionPolicy Bypass -File scripts/image-ai-setup.ps1"
```

- [ ] **Step 5: Document the adult profile clearly**

README states that lawful 18+ adult explicit / Rule 34-style generation is permitted by the local product policy, requires an adult-capable local SDXL checkpoint, and is not sent through a hosted moderation API. It also states the hard exclusions for minors and non-consensual intimate imagery and notes that third-party checkpoint licences must be respected.

- [ ] **Step 6: Run CI-equivalent verification**

```bash
npm test
npm run typecheck
npm run lint
npm run build
```

Expected: all pass without ComfyUI/model weights.

- [ ] **Step 7: Commit**

```bash
git add scripts package.json .gitignore README.md
git commit -m "feat: add Windows local image setup workflow"
```

---

### Task 8: Local RTX 3070 Ti hardware acceptance

**Files:**
- Modify README only if real hardware validation reveals missing setup guidance.

**Acceptance procedure:**

- [ ] Run `npm run image:doctor`.
- [ ] Run `npm run image:setup`.
- [ ] Start `npm run dev`.
- [ ] Confirm `GET /api/runtime/image` reports ComfyUI configured and initially stopped.
- [ ] Generate a general 768x768 image and confirm ResourceManager unloads llama.cpp before ComfyUI claims the GPU.
- [ ] Edit a generated image in the same conversation.
- [ ] Configure an adult-capable SDXL checkpoint and generate a lawful clearly-adult Rule 34-style fictional image; confirm the prompt is not sanitized or sent to an external service.
- [ ] Confirm a sexual prompt explicitly involving a minor is rejected before ComfyUI receives a job.
- [ ] Cancel an in-progress image job and confirm the image lease is released.
- [ ] Send a text prompt after an image job and confirm ComfyUI is stopped before llama.cpp restarts.
- [ ] Record local-only benchmark notes: workflow/profile, resolution, peak observed VRAM, system RAM, first-load latency and generation latency.
- [ ] If FLUX.2 Klein 4B cannot run acceptably on 8 GB even with DynamicVRAM/offload, keep the provider architecture and change the general image profile to the best tested low-VRAM workflow rather than forcing an unstable configuration.

Milestone 3 is complete only when image generation and editing work locally in the same conversation, adult explicit generation works with the configured adult checkpoint, the hard illegal/abusive policy boundaries are enforced before provider execution, and text/image worker switching is stable on the RTX 3070 Ti.
