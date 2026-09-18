import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();

function read(path: string): string {
  const absolutePath = resolve(root, path);
  return existsSync(absolutePath) ? readFileSync(absolutePath, 'utf8') : '';
}

describe('Windows local text AI workflow', () => {
  it('provides a non-mutating doctor for the required local prerequisites', () => {
    const doctor = read('scripts/text-ai-doctor.ps1');

    expect(doctor).not.toBe('');
    expect(doctor).toContain('nvidia-smi');
    expect(doctor).toContain('llama-server');
    expect(doctor).toContain('UNRESTRICTED_AI_LLAMA_SERVER_PATH');
    expect(doctor).toContain('UNRESTRICTED_AI_LLAMA_CACHE_DIR');
    expect(doctor).toContain('node --version');
    expect(doctor).toContain('.env.local');
    expect(doctor).toContain('UNRESTRICTED_AI_LLM_PROVIDER');
    expect(doctor).toMatch(/exit\s+1/i);
  });

  it('normalizes quoted dotenv paths and uses dotenv values for doctor checks', () => {
    const doctor = read('scripts/text-ai-doctor.ps1');

    expect(doctor).toContain('function Normalize-DotEnvValue');
    expect(doctor).toMatch(
      /Get-DotEnvValue \$envfile 'UNRESTRICTED_AI_LLAMA_SERVER_PATH'/i,
    );
    expect(doctor).toMatch(
      /Get-DotEnvValue \$envfile 'UNRESTRICTED_AI_LLAMA_CACHE_DIR'/i,
    );
  });

  it('makes model download an explicit setup action and writes llama mode only after readiness', () => {
    const setup = read('scripts/text-ai-setup.ps1');

    expect(setup).not.toBe('');
    expect(setup).toContain("unsloth/Qwen3.5-9B-GGUF:Q4_K_M");
    expect(setup).toContain(".\\models\\llama-cache");
    expect(setup).toContain('winget install llama.cpp');
    expect(setup).toContain('--hf-repo');
    expect(setup).toContain('--no-mmproj');
    expect(setup).toContain('--host');
    expect(setup).toContain('127.0.0.1');
    expect(setup).toContain('--ctx-size');
    expect(setup).toContain('--n-gpu-layers');
    expect(setup).toContain('--parallel');
    expect(setup).toContain('--flash-attn');
    expect(setup).not.toContain("'--offline'");
    expect(setup).toContain('LLAMA_CACHE');
    expect(setup).toContain('/health');
    expect(setup).toContain('.env.local');
    expect(setup).toContain('UNRESTRICTED_AI_LLM_PROVIDER=llama-cpp');
  });

  it('writes a portable relative llama cache path to dotenv when setup receives one', () => {
    const setup = read('scripts/text-ai-setup.ps1');

    expect(setup).toContain('IsPathRooted($CacheDir)');
    expect(setup).toContain('$cachePathForEnv');
    expect(setup).toContain('UNRESTRICTED_AI_LLAMA_CACHE_DIR="$cachePathForEnv"');
    expect(setup).not.toContain('UNRESTRICTED_AI_LLAMA_CACHE_DIR="$cacheFullPath"');
  });

  it('exposes npm helpers for doctor and explicit setup', () => {
    const packageJson = JSON.parse(read('package.json')) as {
      scripts?: Record<string, string>;
    };

    expect(packageJson.scripts?.['llm:doctor']).toBe(
      'powershell -ExecutionPolicy Bypass -File scripts/text-ai-doctor.ps1',
    );
    expect(packageJson.scripts?.['llm:setup']).toBe(
      'powershell -ExecutionPolicy Bypass -File scripts/text-ai-setup.ps1',
    );
  });

  it('documents the hardware profiles and offline normal runtime', () => {
    const readme = read('README.md');

    expect(readme).toContain('Qwen3.5-9B');
    expect(readme).toContain('Q4_K_M');
    expect(readme).toContain('RTX 3070 Ti');
    expect(readme).toContain('Qwen3.5-4B');
    expect(readme).toContain('8192');
    expect(readme).toContain('auto');
    expect(readme).toContain('--offline');
    expect(readme).toMatch(/model weights.*local/i);
  });
});
