import type { PromptInput, HashOptions, HashResult } from '../types';
import { detectFormat } from '../parser/format-detector';
import { detectSections } from '../parser/section-detector';
import { normalizePipeline } from '../normalize/index';
import { sha256 } from './sha256';
import { extractSkeleton } from './structural';

/**
 * Select the hash function based on algorithm option.
 */
function getHashFn(algorithm: 'sha256' | 'xxhash64'): (input: string) => string {
  // For simplicity, both algorithms use sha256 for now.
  // xxhash64 would need a pure-TS implementation.
  if (algorithm === 'xxhash64') {
    // Simple fast hash for xxhash64 simulation using sha256 truncated
    return (input: string) => sha256(input).slice(0, 16);
  }
  return sha256;
}

/**
 * Normalize a prompt and compute content hashes.
 */
export function hash(
  prompt: PromptInput,
  options?: HashOptions,
): HashResult {
  const start = performance.now();
  const algorithm = options?.algorithm ?? 'sha256';
  const hashFn = getHashFn(algorithm);

  // 1. Parse prompt and extract text
  const { text } = detectFormat(prompt);

  // 2. Apply normalization pipeline
  const { canonical, stepsApplied } = normalizePipeline(text, options);

  // 3. Compute normalized hash
  const normalizedHash = hashFn(canonical);

  // 4. Compute structural skeleton and hash
  const skeleton = extractSkeleton(canonical);
  const structuralHash = hashFn(skeleton);

  // 5. Compute per-section hashes
  const sections = detectSections(canonical);
  const sectionHashes = sections.map((s) => hashFn(s.content));

  const durationMs = performance.now() - start;

  return {
    normalized: normalizedHash,
    structural: structuralHash,
    sections: sectionHashes,
    canonicalForm: canonical,
    algorithm,
    stepsApplied,
    durationMs,
  };
}

export { sha256 } from './sha256';
export { extractSkeleton } from './structural';
