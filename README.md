# Unrestricted AI

Private, local-first personal AI assistant. The application runs on the user's Windows PC and keeps its core AI runtime independent from paid per-token or per-generation APIs.

## Current scope

The current build establishes the local chat/reasoning foundation. Image generation/editing and text-to-video/image-to-video are later milestones; coding-specific assistant features and video-to-video are not part of the current scope.

## Requirements

- Windows
- Node.js 24 LTS
- Git
- Visual Studio Code
- NVIDIA GPU and current Windows driver for the local GPU profile
- `llama.cpp` / `llama-server` when enabling the real local text model

## Application setup

```bash
npm install
npm run db:migrate
npm run dev
```

Open `http://127.0.0.1:3000`.

The default application starts in `mock` LLM mode so development and CI do not need multi-gigabyte model downloads. The default local paths are `./data`, `./models`, and `./outputs`.

Model weights stay local on your PC and, together with generated assets, caches, local databases, `.env.local`, and secrets, are intentionally excluded from Git.

## Local text AI profile

The first hardware profile for this machine is:

- GPU: NVIDIA RTX 3070 Ti with 8 GB VRAM
- Primary model: `unsloth/Qwen3.5-9B-GGUF:Q4_K_M`
- Fallback model: `unsloth/Qwen3.5-4B-GGUF:Q4_K_M` if Qwen3.5-9B latency or memory use is unsatisfactory
- Initial context: `8192` tokens
- GPU layers: `auto`

`8192` context and GPU `auto` are conservative starting values for this PC, not model limits. They can be benchmarked and adjusted later without changing the UI or provider architecture.

### Install llama.cpp

If `llama-server` is not already installed, use the official Windows package:

```powershell
winget install llama.cpp
```

Restart the terminal after installation if the command is not immediately available on `PATH`.

### Check prerequisites

```powershell
npm run llm:doctor
```

The doctor checks Windows, the NVIDIA driver/GPU, `llama-server`, the configured cache location, Node.js 24, and `.env.local` when llama mode is selected. It reports problems but does not install software or permanently change the machine.

### Explicitly download/cache the text model

```powershell
npm run llm:setup
```

This is the explicit setup action that is allowed to access Hugging Face and populate the local `llama.cpp` cache. It starts `llama-server` temporarily, waits until the model is ready, writes the local `.env.local` configuration, and stops the setup server.

The normal Unrestricted AI runtime then starts `llama-server` with `--offline`. If the configured model is missing from cache, normal startup fails instead of silently downloading model weights.

To use the 4B fallback during setup:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/text-ai-setup.ps1 -Model "unsloth/Qwen3.5-4B-GGUF:Q4_K_M"
```

## Runtime diagnostics

With the app running, the safe local text-runtime status is available at:

```text
GET http://127.0.0.1:3000/api/runtime/llm
```

The response exposes only the provider mode, configured state, worker status, resident capability, model label, and loopback base URL. It does not expose local filesystem paths or environment variables.

## Development policy

Development for this project stays on the `main` branch only. Model/runtime implementation details remain behind provider interfaces rather than being embedded in React UI components.
