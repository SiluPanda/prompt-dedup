// prompt-dedup - Detect near-duplicate prompts via content hashing and similarity

export { normalize } from './normalize/index';
export { hash } from './hash/index';
export { similarity, isDuplicate } from './similarity/index';
export { DedupIndex } from './dedup-index/index';

import type { IndexOptions } from './types';
import { DedupIndex } from './dedup-index/index';

/**
 * Create a new DedupIndex for batch deduplication.
 */
export function createIndex(options?: IndexOptions): DedupIndex {
  return new DedupIndex(options);
}

// Re-export all types
export type {
  PromptInput,
  PromptMessage,
  AnthropicPrompt,
  NormalizeOptions,
  HashOptions,
  HashResult,
  SimilarityOptions,
  SimilarityResult,
  DuplicateOptions,
  IndexOptions,
  AddResult,
  FindResult,
  DedupGroup,
  DedupStats,
  SerializedIndex,
  IndexEntry,
} from './types';
