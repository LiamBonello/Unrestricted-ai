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

export class MediaPolicyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MediaPolicyError';
  }
}

const adultExplicitPattern =
  /(?:\brule\s*34\b|\br34\b|\bnsfw\b|\brating[_ -]?explicit\b|\bexplicit\b|\bnude\b|\bnaked\b|\bporn(?:ographic)?\b|\bsexual\b|\bsex\b|\bgenitals?\b|\bpenis\b|\bvagina\b)/i;

const underageTermPattern =
  /\b(?:minor|underage|child|children|preteen|pre-teen|young\s+teen|young\s+teenager)\b/i;

const under18AgePattern =
  /\b(?:age\s*)?(?:[0-9]|1[0-7])(?:\s*[- ]\s*year\s*[- ]\s*old|\s+years?\s+old)\b/i;

export function enforceMediaPolicy(request: MediaPolicyRequest): MediaPolicyDecision {
  const normalizedPrompt = request.prompt.trim();
  if (!normalizedPrompt) throw new MediaPolicyError('Image prompt cannot be empty');

  const contentMode: ImageContentMode = adultExplicitPattern.test(normalizedPrompt)
    ? 'adult-explicit'
    : 'general';

  if (
    contentMode === 'adult-explicit'
    && (underageTermPattern.test(normalizedPrompt) || under18AgePattern.test(normalizedPrompt))
  ) {
    throw new MediaPolicyError('Sexual content involving minors is not allowed');
  }

  if (
    contentMode === 'adult-explicit'
    && request.hasUploadedInput
    && request.consentConfirmed !== true
  ) {
    throw new MediaPolicyError('Explicit edits of uploaded people require consent confirmation');
  }

  return { contentMode, normalizedPrompt };
}
