import { describe, expect, it } from 'vitest';
import {
  buildSdxlImageEditWorkflow,
  buildSdxlTextToImageWorkflow,
} from './sdxl';

describe('SDXL workflow mapping', () => {
  it('maps an adult prompt unchanged into a local checkpoint text-to-image workflow', () => {
    const prompt = 'rating_explicit, adult fictional woman, age 25, nude';
    const workflow = buildSdxlTextToImageWorkflow({
      checkpoint: 'adult-local.safetensors',
      prompt,
      negativePrompt: 'low quality',
      width: 768,
      height: 768,
      seed: 7284,
    });

    expect(workflow['4']).toEqual({
      class_type: 'CheckpointLoaderSimple',
      inputs: { ckpt_name: 'adult-local.safetensors' },
    });
    expect(workflow['6']?.inputs.text).toBe(prompt);
    expect(workflow['7']?.inputs.text).toBe('low quality');
    expect(workflow['5']?.inputs).toEqual({ width: 768, height: 768, batch_size: 1 });
    expect(workflow['3']?.inputs.seed).toBe(7284);
    expect(JSON.stringify(workflow)).not.toContain('C:\\');
  });

  it('uses a ComfyUI input filename rather than a filesystem path for image editing', () => {
    const workflow = buildSdxlImageEditWorkflow({
      checkpoint: 'adult-local.safetensors',
      prompt: 'Change the outfit while preserving the adult subject',
      negativePrompt: '',
      inputFilename: 'upload-id.png',
      seed: 99,
      denoise: 0.72,
    });

    expect(workflow['5']).toEqual({
      class_type: 'LoadImage',
      inputs: { image: 'upload-id.png' },
    });
    expect(workflow['3']?.inputs.denoise).toBe(0.72);
    expect(workflow['10']?.class_type).toBe('VAEEncode');
    expect(JSON.stringify(workflow)).not.toContain('C:\\');
  });
});
