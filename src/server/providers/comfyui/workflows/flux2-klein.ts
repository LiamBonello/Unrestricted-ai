import type { ComfyWorkflow } from '../types';

export interface Flux2KleinModels {
  unetName: string;
  clipName: string;
  vaeName: string;
}

export interface Flux2KleinTextToImageInput extends Flux2KleinModels {
  prompt: string;
  width: number;
  height: number;
  seed: number;
}

export interface Flux2KleinImageEditInput extends Flux2KleinModels {
  prompt: string;
  inputFilename: string;
  seed: number;
}

function modelNodes(input: Flux2KleinModels): ComfyWorkflow {
  return {
    '70': {
      class_type: 'UNETLoader',
      inputs: { unet_name: input.unetName, weight_dtype: 'default' },
    },
    '71': {
      class_type: 'CLIPLoader',
      inputs: {
        clip_name: input.clipName,
        type: 'flux2',
        device: 'default',
      },
    },
    '72': {
      class_type: 'VAELoader',
      inputs: { vae_name: input.vaeName },
    },
  };
}

function samplingNodes(input: {
  prompt: string;
  seed: number;
  width: number | [string, number];
  height: number | [string, number];
  positive: [string, number];
  negative: [string, number];
}): ComfyWorkflow {
  return {
    '74': {
      class_type: 'CLIPTextEncode',
      inputs: { text: input.prompt, clip: ['71', 0] },
    },
    '73': {
      class_type: 'RandomNoise',
      inputs: { noise_seed: input.seed },
    },
    '61': {
      class_type: 'KSamplerSelect',
      inputs: { sampler_name: 'euler' },
    },
    '62': {
      class_type: 'Flux2Scheduler',
      inputs: {
        steps: 4,
        width: input.width,
        height: input.height,
      },
    },
    '63': {
      class_type: 'CFGGuider',
      inputs: {
        model: ['70', 0],
        positive: input.positive,
        negative: input.negative,
        cfg: 1,
      },
    },
    '64': {
      class_type: 'SamplerCustomAdvanced',
      inputs: {
        noise: ['73', 0],
        guider: ['63', 0],
        sampler: ['61', 0],
        sigmas: ['62', 0],
        latent_image: ['66', 0],
      },
    },
    '65': {
      class_type: 'VAEDecode',
      inputs: { samples: ['64', 0], vae: ['72', 0] },
    },
    '9': {
      class_type: 'SaveImage',
      inputs: { filename_prefix: 'UnrestrictedAI', images: ['65', 0] },
    },
  };
}

export function buildFlux2KleinTextToImageWorkflow(
  input: Flux2KleinTextToImageInput,
): ComfyWorkflow {
  return {
    ...modelNodes(input),
    ...samplingNodes({
      prompt: input.prompt,
      seed: input.seed,
      width: input.width,
      height: input.height,
      positive: ['74', 0],
      negative: ['82', 0],
    }),
    '82': {
      class_type: 'ConditioningZeroOut',
      inputs: { conditioning: ['74', 0] },
    },
    '66': {
      class_type: 'EmptyFlux2LatentImage',
      inputs: {
        width: input.width,
        height: input.height,
        batch_size: 1,
      },
    },
  };
}

export function buildFlux2KleinImageEditWorkflow(
  input: Flux2KleinImageEditInput,
): ComfyWorkflow {
  return {
    ...modelNodes(input),
    ...samplingNodes({
      prompt: input.prompt,
      seed: input.seed,
      width: ['99', 0],
      height: ['99', 1],
      positive: ['123', 0],
      negative: ['121', 0],
    }),
    '80': {
      class_type: 'LoadImage',
      inputs: { image: input.inputFilename },
    },
    '81': {
      class_type: 'ImageScaleToTotalPixels',
      inputs: {
        image: ['80', 0],
        upscale_method: 'nearest-exact',
        megapixels: 1,
        resolution: 1,
      },
    },
    '99': {
      class_type: 'GetImageSize',
      inputs: { image: ['81', 0] },
    },
    '122': {
      class_type: 'VAEEncode',
      inputs: { pixels: ['81', 0], vae: ['72', 0] },
    },
    '82': {
      class_type: 'ConditioningZeroOut',
      inputs: { conditioning: ['74', 0] },
    },
    '123': {
      class_type: 'ReferenceLatent',
      inputs: {
        conditioning: ['74', 0],
        latent: ['122', 0],
      },
    },
    '121': {
      class_type: 'ReferenceLatent',
      inputs: {
        conditioning: ['82', 0],
        latent: ['122', 0],
      },
    },
    '66': {
      class_type: 'EmptyFlux2LatentImage',
      inputs: {
        width: ['99', 0],
        height: ['99', 1],
        batch_size: 1,
      },
    },
  };
}
