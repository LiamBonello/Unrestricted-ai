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
    uploadsDir: resolveLocalPath(process.env.UNRESTRICTED_AI_UPLOADS_DIR, './uploads'),
  } as const;
}
