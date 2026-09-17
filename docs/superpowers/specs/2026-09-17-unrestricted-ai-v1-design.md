# Unrestricted AI v1 — Architecture Design

Date: 2026-09-17
Repository: `LiamBonello/Unrestricted-ai`
Branch policy: `main` only
Status: Design for review before implementation

## 1. Product goal

Unrestricted AI is a private, single-user, local-first AI assistant that presents one coherent interface while routing work to specialised local models behind the scenes.

The product should feel like one assistant, not a collection of model dashboards. A user asks for chat, coding, reasoning, image generation/editing, or video generation in the same conversation; the orchestration layer decides which capability handles the request and preserves conversational context across capability changes.

The platform is intentionally designed to avoid ongoing per-token, per-message, or per-generation API fees. Core inference runs locally using open-source or open-weight models. External paid APIs are not part of the required architecture.

The user owns the machine, model selection, prompts, tools, moderation policy, branding, data, and usage limits. The product may support lawful mature and controversial content more broadly than mainstream hosted assistants. Hard boundaries for illegal or abusive content remain a product-policy concern and are kept separate from model/runtime code so policy is configurable without coupling it to providers.

## 2. Hardware baseline

The v1 design targets the user's current PC rather than hypothetical future hardware:

- CPU: Intel Core i9-12900K
- GPU: NVIDIA GeForce RTX 3070 Ti, 8 GB VRAM
- RAM: 32 GB DDR4-3600
- Fast storage: Samsung 980 PRO 1 TB NVMe
- Bulk storage: Samsung 870 QVO 2 TB SSD
- Development environment: Windows, Visual Studio Code

The principal constraint is the 8 GB VRAM budget. CPU performance is strong and 32 GB system RAM gives useful headroom for offloading, but the architecture must never assume that multiple heavy generative models can remain resident in VRAM simultaneously.

A future upgrade to 64 GB RAM would improve CPU/offload-heavy media workflows. A future 24 GB+ VRAM GPU would materially improve image/video capability, but no v1 architecture should depend on either upgrade.

## 3. Core architectural decisions

### 3.1 Single local application

V1 is single-user and local-only. It does not require:

- authentication
- billing or credits
- rate limiting
- public hosting
- multi-user GPU scheduling
- cloud databases
- remote model providers

The application binds to localhost by default. Remote access is out of scope for v1.

### 3.2 Windows-native runtime baseline

V1 AI runtimes will run natively on Windows.

Reason: the current ComfyUI memory-management stack includes DynamicVRAM, CPU offloading, async offloading, `lowvram`, `novram`, VRAM reservation, and disk-backed dynamic loading. These features are directly relevant to an 8 GB GPU, while current ComfyUI guidance warns that WSL support for DynamicVRAM may not be available. A pure-WSL deployment would therefore add risk exactly where this machine is most constrained.

WSL2 remains optional for development utilities or future workloads, but it is not a dependency of v1.

### 3.3 Provider abstraction

No UI component should know about Qwen, FLUX, Wan, LTX, llama.cpp, ComfyUI, or any other concrete model/runtime.

The backend exposes capability interfaces such as:

- `LLMProvider`
- `ImageProvider`
- `VideoProvider`
- `ToolProvider`

This lets the underlying model change without rewriting the UI or conversation layer.

### 3.4 One heavyweight GPU workload at a time

The machine has one 8 GB GPU. The orchestrator therefore owns a resource manager with explicit model lifecycle control.

Expected flow:

1. LLM handles conversation normally.
2. User requests an image or video.
3. Conversation state is persisted independently of model state.
4. The resource manager stops or unloads the current heavyweight worker as necessary.
5. The requested media worker runs with GPU/CPU/RAM offloading.
6. Output is persisted and returned into the same conversation.
7. Media resources are released.
8. The LLM worker is restored when needed.

The system must favour reliability over pretending simultaneous residency is possible.

## 4. High-level system

```text
Browser UI
   |
   v
Local Web App
   |
   v
Orchestrator API
   |
   +--> Capability Router
   |
   +--> Conversation Service
   |
   +--> Resource / Model Manager
   |
   +--> Provider Registry
   |      |
   |      +--> LLM Provider ----> llama.cpp / compatible local server
   |      +--> Image Provider --> ComfyUI workflows
   |      +--> Video Provider --> ComfyUI / dedicated video runtime
   |      +--> Tool Provider ---> filesystem / web / code / future tools
   |
   +--> Local Persistence
          +--> SQLite metadata
          +--> filesystem assets
```

## 5. Technology direction

### 5.1 Frontend

Preferred stack:

- Next.js
- React
- TypeScript strict mode
- latest stable Material UI

MUI usage should follow existing project standards once the codebase exists: prefer `Box`, `Stack`, `Typography`, `sx`, theme tokens, and current stable APIs. Avoid deprecated APIs.

The UI is ChatGPT-style but should not clone ChatGPT visually. V1 needs:

- conversation list
- message stream
- streaming text
- code blocks
- image attachments
- generated image rendering
- generated video rendering
- stop/cancel generation
- generation status
- model/resource status in a developer/debug surface, not the normal user flow

The normal interface should say "Unrestricted AI", not expose implementation model names unless the user deliberately opens diagnostics/settings.

### 5.2 Local application/backend

Use TypeScript for the primary orchestrator and application APIs. Keep provider adapters isolated from UI and persistence.

Python is allowed where the model ecosystem requires it, particularly for ComfyUI/media workflows. The TypeScript orchestrator communicates with those runtimes over local HTTP/WebSocket interfaces rather than importing Python model code directly into UI/application components.

### 5.3 LLM runtime

Initial runtime target: `llama.cpp` or a compatible local server exposing a stable HTTP API.

Initial model candidate: Qwen3.5-9B in an appropriate GGUF quantization, with Qwen3.5-4B retained as a lighter fallback/profile.

Reasons:

- strong general/coding/reasoning capability for the hardware class
- Apache 2.0 model licence for current Qwen3.5 9B/4B releases
- GGUF support enables aggressive quantization
- llama.cpp supports local operation and GPU/CPU split strategies

The exact quantization, context length, GPU layer count, and KV-cache configuration must be benchmarked on the user's actual machine during the model-runtime milestone. They are configuration, not hardcoded architecture.

### 5.4 Image runtime

Initial candidate: FLUX.2 [klein] 4B, subject to benchmark.

Reasons:

- text-to-image
- single-reference editing
- multi-reference editing
- Apache 2.0 licence for the 4B model
- explicitly designed for consumer GPU use around the 8 GB class

ComfyUI is the preferred initial execution layer because its workflow API and memory-management capabilities are useful on constrained VRAM.

### 5.5 Video runtime

Video is a first-class architectural capability but not the first implementation milestone.

V1 provider interface must be capable of supporting:

- text-to-video
- image-to-video
- later: video-to-video
- later: extension/interpolation/upscaling

The concrete initial model is deliberately not frozen in this design. Current high-quality open video models are substantially heavier than the user's 8 GB VRAM budget, and low-VRAM operation often depends on quantized/community workflows that change rapidly.

The video milestone therefore begins with a hardware benchmark against then-current candidates (for example LTX-family or Wan-family low-VRAM workflows) and chooses the best usable model at implementation time.

The architecture must allow swapping the model later without changing conversation/UI code.

## 6. Capability router

The router receives a normalized user request containing:

- conversation context
- text
- attachments
- explicit user intent where present
- available capabilities

Routing policy should use a deterministic-first approach:

1. explicit commands/intents and attachment types
2. lightweight rules for obvious tasks
3. LLM classification only where ambiguity remains

Examples:

- "Generate an image of..." -> image
- "Edit this image..." + image attachment -> image editing
- "Animate this" + prior generated image -> image-to-video
- normal question/code request -> LLM

Do not use a heavy LLM call merely to route every obvious request.

## 7. Conversation and asset model

Conversation state must be provider-independent.

A message can contain ordered content parts such as:

- text
- code
- image input
- image output
- video input
- video output
- tool invocation
- tool result
- status/error

Generated assets live on disk. SQLite stores metadata and references rather than binary media blobs.

A follow-up such as "animate this" should resolve "this" to the relevant prior asset in the same conversation without requiring the user to re-upload it.

## 8. Local persistence

V1 persistence:

- SQLite for conversations, messages, generation jobs, model profiles, and asset metadata
- filesystem for uploads and generated outputs

Suggested local data roots are configurable and are never committed to Git.

Active models/cache should favour the Samsung 980 PRO NVMe. Large archives and generated media can use the 870 QVO 2 TB drive.

## 9. Resource manager

The resource manager is a core subsystem, not an optimization added later.

Responsibilities:

- know which worker/model currently owns GPU resources
- serialize heavyweight GPU jobs by default
- start/stop local runtimes
- expose health/readiness
- cancel generations
- recover from worker crashes
- enforce timeouts
- record VRAM/RAM configuration profiles
- release media resources after idle periods

Provider adapters request capabilities from the resource manager; they should not independently fight for GPU memory.

V1 does not require complex distributed scheduling. A single in-process job queue plus explicit worker lifecycle is sufficient.

## 10. Error handling

Failures must be surfaced as product-level errors rather than raw Python/CUDA output.

Examples:

- out of VRAM -> retry with configured lower-memory profile where safe, otherwise explain which generation setting exceeded the local hardware profile
- worker unavailable -> restart once, then fail clearly
- cancelled job -> mark cancelled and release resources
- model missing -> report setup requirement instead of silently downloading huge files unless the user explicitly starts installation
- disk full -> stop before generation when possible

Raw logs remain available in a developer diagnostics view/file.

## 11. Repository and local-data rules

Repository policy:

- use `main` only
- no feature branches unless the user explicitly changes this policy
- model weights are never committed
- generated assets are never committed
- secrets/local paths are never committed

Initial `.gitignore` should cover at least:

```text
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

Large model locations should be configurable by environment/config rather than hardcoded Windows drive paths.

## 12. Security and policy boundary

Because v1 is local-only, network attack surface is minimized by binding services to loopback interfaces unless explicitly configured otherwise.

The system's behavioural policy must be its own layer rather than embedded throughout provider implementations. This permits broad lawful use and future policy adjustment while still allowing clear hard blocks for illegal/abusive categories.

No third-party moderation API is required for local operation.

## 13. Scope decomposition and implementation order

The overall product is too large to implement as one undifferentiated task. Build it as successive vertical milestones on the same `main` branch.

### Milestone 1 — Foundation

Goal: a working local application shell with no heavy model requirement.

- repository/tooling setup
- Next.js + TypeScript + MUI UI
- local orchestrator boundary
- SQLite schema/migrations
- conversation/message domain model
- provider interfaces
- resource-manager interface
- health endpoint
- basic chat shell with mocked provider

Acceptance: application starts locally, a conversation persists across restart, and a mock streamed reply passes through the same provider/orchestrator path real models will use.

### Milestone 2 — Local text AI

- llama.cpp integration
- Qwen model profile
- streaming generation
- cancellation
- context construction
- coding/markdown rendering
- hardware benchmark/config profile

Acceptance: normal chat/coding works fully offline with no paid API.

### Milestone 3 — Images

- ComfyUI local integration
- FLUX.2 Klein 4B benchmark/profile
- text-to-image
- image editing
- attachments/assets
- media job progress/cancellation

Acceptance: image generation/editing occurs in the same conversation and does not require manual model switching.

### Milestone 4 — Automatic routing and lifecycle

- intent router
- model/worker swapping
- resource queue
- asset-reference resolution
- recovery/fallback behaviour

Acceptance: text and image requests can be mixed in one conversation while GPU ownership is managed automatically.

### Milestone 5 — Video

- benchmark current low-VRAM video candidates
- select initial local profile
- text-to-video where practical
- image-to-video
- video asset rendering/history

Acceptance: at least one useful local video workflow runs on the RTX 3070 Ti without external paid inference.

### Milestone 6+ — tools, research, voice, agents, computer control

These are explicitly deferred until the core assistant/model lifecycle is stable.

## 14. Testing strategy

Testing begins at the domain/provider boundaries rather than requiring GPU inference for every test.

- unit tests for routing, conversation mapping, job lifecycle, provider contracts
- integration tests with mock providers
- SQLite migration tests
- API streaming/cancellation tests
- explicit opt-in hardware smoke tests for real local models
- manual VRAM/RAM benchmark checklist for model profiles

CI should not attempt to download or run multi-gigabyte models.

## 15. Non-goals for v1

Do not add these during the initial foundation:

- user accounts
- subscriptions/billing
- cloud deployment
- public API hosting
- distributed workers
- Kubernetes
- multi-GPU support
- model marketplace
- plugin marketplace
- autonomous multi-agent system
- voice/video before the provider/resource foundations are stable

## 16. Design principles

1. One assistant experience, many replaceable providers.
2. Hardware constraints are explicit and measured, not hidden.
3. Heavy GPU workloads are serialized unless benchmarks prove concurrency is safe.
4. Conversation state never depends on a model remaining loaded.
5. Model/runtime details do not leak into UI components.
6. Local-first and offline-capable by default.
7. No paid API is required for core operation.
8. Licences are checked before a model becomes a default provider.
9. Configuration replaces hardcoded machine-specific paths and model values.
10. Build the smallest vertical slice that proves each architectural layer before adding the next capability.

## 17. Assumptions to validate during implementation

- Windows 11 is the host OS.
- Current NVIDIA drivers support the required CUDA runtime.
- The active model/cache directory has sufficient free space on the 980 PRO.
- Qwen3.5-9B GGUF offers acceptable latency/quality on the 3070 Ti + 12900K; if not, the 4B profile becomes the default.
- FLUX.2 Klein 4B is usable at the target resolutions under the selected ComfyUI memory profile.
- A useful video model/workflow can be made stable enough on 8 GB VRAM; otherwise the provider remains architecturally present while the hardware profile documents the practical limitation.

These are benchmark questions, not reasons to redesign the application.
