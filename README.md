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
