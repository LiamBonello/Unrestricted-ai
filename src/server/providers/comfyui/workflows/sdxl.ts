import type { ComfyWorkflow } from '../types';

export interface SdxlTextToImageInput {
  checkpoint: string;
  prompt: string;
  negativePrompt: string;
  width: number;
  height: number;
  seed: number;
}

export interface SdxlImageEditInput {
  checkpoint: string;
  prompt: string;
  negativePrompt: string;
  inputFilename: string;
  seed: number;
  denoise: number;
}

function commonNodes(
  checkpoint: string,
  prompt: string,
  negativePrompt: string,
  seed: number,
  latent: [string, number],
  denoise: number,
): ComfyWorkflow {
  return {
    '4': {
      class_type: 'CheckpointLoaderSimple',
      inputs: { ckpt_name: checkpoint },
    },
    '6': {
      class_type: 'CLIPTextEncode',
      inputs: { text: prompt, clip: ['4', 1] },
    },
    '7': {
      class_type: 'CLIPTextEncode',
      inputs: { text: negativePrompt, clip: ['4', 1] },
    },
    '3': {
      class_type: 'KSampler',
      inputs: {
        seed,
        steps: 28,
        cfg: 6.5,
        sampler_name: 'dpmpp_2m',
        scheduler: 'karras',
        denoise,
        model: ['4', 0],
        positive: ['6', 0],
        negative: ['7', 0],
        latent_image: latent,
      },
    },
    '8': {
      class_type: 'VAEDecode',
      inputs: { samples: ['3', 0], vae: ['4', 2] },
    },
    '9': {
      class_type: 'SaveImage',
      inputs: { filename_prefix: 'UnrestrictedAI', images: ['8', 0] },
    },
  };
}

export function buildSdxlTextToImageWorkflow(
  input: SdxlTextToImageInput,
): ComfyWorkflow {
  return {
    ...commonNodes(
      input.checkpoint,
      input.prompt,
      input.negativePrompt,
      input.seed,
      ['5', 0],
      1,
    ),
    '5': {
      class_type: 'EmptyLatentImage',
      inputs: {
        width: input.width,
        height: input.height,
        batch_size: 1,
      },
    },
  };
}

export function buildSdxlImageEditWorkflow(
  input: SdxlImageEditInput,
): ComfyWorkflow {
  return {
    ...commonNodes(
      input.checkpoint,
      input.prompt,
      input.negativePrompt,
      input.seed,
      ['10', 0],
      input.denoise,
    ),
    '5': {
      class_type: 'LoadImage',
      inputs: { image: input.inputFilename },
    },
    '10': {
      class_type: 'VAEEncode',
      inputs: { pixels: ['5', 0], vae: ['4', 2] },
    },
  };
}
