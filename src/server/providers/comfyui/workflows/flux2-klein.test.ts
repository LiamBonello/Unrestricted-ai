import { describe, expect, it } from 'vitest';
import {
  buildFlux2KleinImageEditWorkflow,
  buildFlux2KleinTextToImageWorkflow,
} from './flux2-klein';

const models = {
  unetName: 'flux-2-klein-4b-fp8.safetensors',
  clipName: 'qwen_3_4b.safetensors',
  vaeName: 'flux2-vae.safetensors',
};

describe('FLUX.2 Klein workflow mapping', () => {
  it('builds the current 4B distilled API workflow with caller-owned prompt and sizing', () => {
    const prompt = 'A glass city floating above the sea';
    const workflow = buildFlux2KleinTextToImageWorkflow({
      ...models,
      prompt,
      width: 768,
      height: 768,
      seed: 1234,
    });

    expect(workflow['70']?.inputs).toMatchObject({
      unet_name: models.unetName,
      weight_dtype: 'default',
    });
    expect(workflow['71']?.inputs).toMatchObject({
      clip_name: models.clipName,
      type: 'flux2',
      device: 'default',
    });
    expect(workflow['72']?.inputs.vae_name).toBe(models.vaeName);
    expect(workflow['74']?.inputs.text).toBe(prompt);
    expect(workflow['73']?.inputs.noise_seed).toBe(1234);
    expect(workflow['66']?.inputs).toMatchObject({
      width: 768,
      height: 768,
      batch_size: 1,
    });
    expect(workflow['62']?.inputs).toMatchObject({
      steps: 4,
      width: 768,
      height: 768,
    });
    expect(JSON.stringify(workflow)).not.toContain('C:\\');
  });

  it('builds the official distilled image-edit topology around an uploaded ComfyUI filename', () => {
    const prompt = 'Turn the red car blue';
    const workflow = buildFlux2KleinImageEditWorkflow({
      ...models,
      prompt,
      inputFilename: 'upload-id.webp',
      seed: 9876,
    });

    expect(workflow['80']).toEqual({
      class_type: 'LoadImage',
      inputs: { image: 'upload-id.webp' },
    });
    expect(workflow['74']?.inputs.text).toBe(prompt);
    expect(workflow['73']?.inputs.noise_seed).toBe(9876);
    expect(workflow['82']?.class_type).toBe('ConditioningZeroOut');
    expect(workflow['121']?.class_type).toBe('ReferenceLatent');
    expect(workflow['123']?.class_type).toBe('ReferenceLatent');
    expect(workflow['122']?.class_type).toBe('VAEEncode');
    expect(JSON.stringify(workflow)).not.toContain('C:\\');
  });
});
