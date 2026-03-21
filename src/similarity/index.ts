import type { PromptInput, SimilarityOptions, SimilarityResult } from '../types';
import { detectFormat } from '../parser/format-detector';
import { normalizePipeline } from '../normalize/index';
import { jaccardSimilarity } from './jaccard';
import { shingleSimilarity } from './shingle';
import { editDistanceSimilarity } from './edit-distance';
import { structuralSimilarity } from './structural';

const DEFAULT_WEIGHTS = {
  jaccard: 0.3,
  shingle: 0.3,
  edit: 0.2,
  structure: 0.2,
};

/**
 * Compute composite similarity score between two prompts.
 */
export function similarity(
  promptA: PromptInput,
  promptB: PromptInput,
  options?: SimilarityOptions,
): SimilarityResult {
  const start = performance.now();

  const threshold = options?.threshold ?? 0.85;
  const shingleSize = options?.shingleSize ?? 3;
  const maxEditDistanceLength = options?.maxEditDistanceLength ?? 10000;

  const weights = {
    ...DEFAULT_WEIGHTS,
    ...options?.weights,
  };

  // Normalize both prompts
  const { text: textA } = detectFormat(promptA);
  const { text: textB } = detectFormat(promptB);

  const { canonical: normalizedA } = normalizePipeline(textA, options);
  const { canonical: normalizedB } = normalizePipeline(textB, options);

  // Compute individual metrics
  const jaccard = jaccardSimilarity(normalizedA, normalizedB);
  const shingle = shingleSimilarity(normalizedA, normalizedB, shingleSize);
  const editDistance = editDistanceSimilarity(normalizedA, normalizedB, maxEditDistanceLength);
  const structural = structuralSimilarity(textA, textB);

  // Compute weighted composite score
  const score =
    weights.jaccard * jaccard +
    weights.shingle * shingle +
    weights.edit * editDistance +
    weights.structure * structural;

  const durationMs = performance.now() - start;

  return {
    score,
    jaccard,
    shingle,
    editDistance,
    structural,
    isDuplicate: score >= threshold,
    threshold,
    durationMs,
  };
}

/**
 * Convenience function: returns true if two prompts are near-duplicates.
 */
export function isDuplicate(
  promptA: PromptInput,
  promptB: PromptInput,
  options?: SimilarityOptions,
): boolean {
  return similarity(promptA, promptB, options).isDuplicate;
}

export { jaccardSimilarity } from './jaccard';
export { shingleSimilarity } from './shingle';
export { editDistanceSimilarity } from './edit-distance';
export { structuralSimilarity } from './structural';
