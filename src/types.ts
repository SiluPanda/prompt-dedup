/**
 * A prompt in any supported format.
 */
export type PromptInput =
  | string
  | PromptMessage[]
  | AnthropicPrompt
  | { file: string };

/** A single message in a message array (OpenAI-style). */
export interface PromptMessage {
  role: 'system' | 'user' | 'assistant' | 'developer';
  content: string;
}

/** Anthropic-style prompt with separate system field. */
export interface AnthropicPrompt {
  system: string;
  messages: Array<{ role: 'user' | 'assistant'; content: string }>;
}

/** Configuration for the normalization pipeline. */
export interface NormalizeOptions {
  /** Enable or disable individual normalization steps. */
  steps?: {
    whitespace?: boolean;
    case?: boolean;
    variables?: boolean;
    'section-order'?: boolean;
    'example-order'?: boolean;
    formatting?: boolean;
  };

  /** Template syntax to use for variable extraction. Default: 'auto'. */
  templateSyntax?: 'auto' | 'handlebars' | 'jinja2' | 'fstring' | 'dollar';
}

/** Configuration for hash computation. */
export interface HashOptions extends NormalizeOptions {
  /** Hash algorithm to use. Default: 'sha256'. */
  algorithm?: 'sha256' | 'xxhash64';
}

/** Result of a hash() call. */
export interface HashResult {
  /** Hash of the fully normalized prompt. Primary dedup key. */
  normalized: string;
  /** Hash of the structural skeleton only. */
  structural: string;
  /** Per-section hashes, one per detected section. */
  sections: string[];
  /** The canonical (normalized) form of the prompt. */
  canonicalForm: string;
  /** The hash algorithm used. */
  algorithm: 'sha256' | 'xxhash64';
  /** Metadata about the normalization steps applied. */
  stepsApplied: string[];
  /** Wall-clock time for normalization and hashing, in milliseconds. */
  durationMs: number;
}

/** Configuration for similarity scoring. */
export interface SimilarityOptions extends NormalizeOptions {
  /** Weights for the composite similarity score. Must sum to 1.0. */
  weights?: {
    jaccard?: number;
    shingle?: number;
    edit?: number;
    structure?: number;
  };
  /** N-gram size for shingling similarity. Default: 3. */
  shingleSize?: number;
  /** Similarity threshold for duplicate classification. Default: 0.85. */
  threshold?: number;
  /** Max prompt length for edit distance. Default: 10000. */
  maxEditDistanceLength?: number;
}

/** Result of a similarity() call. */
export interface SimilarityResult {
  /** Composite similarity score (0.0 to 1.0). */
  score: number;
  /** Token-level Jaccard similarity. */
  jaccard: number;
  /** N-gram shingling similarity. */
  shingle: number;
  /** Normalized edit distance similarity. */
  editDistance: number;
  /** Structural similarity. */
  structural: number;
  /** Whether the prompts are classified as duplicates. */
  isDuplicate: boolean;
  /** The threshold used for classification. */
  threshold: number;
  /** Wall-clock time in milliseconds. */
  durationMs: number;
}

/** Configuration for isDuplicate(). */
export interface DuplicateOptions extends SimilarityOptions {
  /** Similarity threshold. Default: 0.85. */
  threshold?: number;
}

/** Configuration for createIndex(). */
export interface IndexOptions extends HashOptions {
  /** Similarity threshold for grouping duplicates. Default: 0.85. */
  threshold?: number;
  /** Maximum number of prompts the index can hold. Default: 100000. */
  maxSize?: number;
  /** Whether to use near-duplicate detection via similarity. Default: true. */
  nearDuplicateDetection?: boolean;
}

/** Result of index.add(). */
export interface AddResult {
  /** The normalized hash of the added prompt. */
  hash: string;
  /** Whether this prompt is a duplicate of an existing entry. */
  isDuplicate: boolean;
  /** The hash of the existing entry this duplicates (if isDuplicate). */
  duplicateOf?: string;
  /** The similarity score with the matched entry (if isDuplicate). */
  similarity?: number;
  /** The group ID this prompt was assigned to. */
  groupId: string;
}

/** Result of index.find(). */
export interface FindResult {
  /** The normalized hash of the nearest match. */
  hash: string;
  /** The similarity score with the nearest match. */
  similarity: number;
  /** The group ID of the nearest match. */
  groupId: string;
  /** The canonical form of the nearest match. */
  canonicalForm: string;
}

/** A group of duplicate prompts. */
export interface DedupGroup {
  /** Unique group identifier. */
  groupId: string;
  /** Hash of the canonical (first-added) member. */
  canonical: string;
  /** Hashes of all members in this group. */
  members: string[];
  /** Number of members. */
  count: number;
}

/** Deduplication statistics. */
export interface DedupStats {
  /** Total number of prompts added to the index. */
  totalAdded: number;
  /** Number of unique dedup groups. */
  uniqueGroups: number;
  /** Number of duplicate prompts detected. */
  duplicatesFound: number;
  /** Deduplication rate: duplicatesFound / totalAdded. */
  deduplicationRate: number;
  /** Memory usage estimate in bytes. */
  memoryUsageBytes: number;
}

/** Serialized form of the index for persistence. */
export interface SerializedIndex {
  version: number;
  algorithm: 'sha256' | 'xxhash64';
  threshold: number;
  entries: Array<{
    hash: string;
    canonicalForm: string;
    groupId: string;
    metadata?: Record<string, unknown>;
    addedAt: string;
  }>;
  groups: DedupGroup[];
}

/** Internal index entry. */
export interface IndexEntry {
  hash: string;
  canonicalForm: string;
  groupId: string;
  metadata?: Record<string, unknown>;
  addedAt: string;
}
