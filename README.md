# prompt-dedup

Detect near-duplicate LLM prompts via content hashing and similarity scoring.

[![npm version](https://img.shields.io/npm/v/prompt-dedup.svg)](https://www.npmjs.com/package/prompt-dedup)
[![license](https://img.shields.io/npm/l/prompt-dedup.svg)](https://github.com/SiluPanda/prompt-dedup/blob/master/LICENSE)
[![node](https://img.shields.io/node/v/prompt-dedup.svg)](https://nodejs.org)

---

## Description

`prompt-dedup` normalizes prompt text through a configurable pipeline -- collapsing whitespace, extracting template variables, ordering sections, stripping formatting -- then computes content hashes and similarity scores to determine whether two prompts are duplicates, near-duplicates, or distinct.

LLM applications frequently send semantically identical prompts that differ only in whitespace, variable naming, formatting style, or inconsequential structural variations. These cosmetic differences produce different cache keys under exact string matching, causing cache misses and unnecessary API spend. `prompt-dedup` solves this by normalizing prompts before hashing, ensuring that semantically identical prompts produce identical hashes regardless of surface-level differences.

The package provides both a programmatic TypeScript/JavaScript API and an in-memory `DedupIndex` for batch deduplication across large prompt collections. It supports plain text strings, OpenAI-style message arrays, and Anthropic-style prompt objects. Zero runtime dependencies. Runs in milliseconds.

---

## Installation

```bash
npm install prompt-dedup
```

Requires Node.js >= 18.

---

## Quick Start

```typescript
import { normalize, hash, similarity, isDuplicate, createIndex } from 'prompt-dedup';

// 1. Normalize a prompt to its canonical form
const canonical = normalize('You are a helpful assistant.\n\n\n   Answer questions.   ');
// => "You are a helpful assistant.\n\nAnswer questions."

// 2. Hash a prompt for cache key usage
const result = hash('You are a helpful assistant. Answer questions.');
console.log(result.normalized);  // 64-char SHA-256 hex string
console.log(result.structural);  // structural skeleton hash
console.log(result.canonicalForm); // the normalized text

// 3. Compare two prompts
const sim = similarity(
  'You are a helpful assistant. Answer questions clearly.',
  'You are a helpful assistant. Answer questions concisely.',
);
console.log(sim.score);       // 0.0 - 1.0 composite similarity
console.log(sim.isDuplicate); // true if score >= threshold (default 0.85)

// 4. Quick duplicate check
isDuplicate('You are helpful.', 'You are   helpful.'); // true

// 5. Batch deduplication with an index
const index = createIndex({ threshold: 0.85 });
index.add('You are a helpful assistant. Answer questions.');
index.add('You are a helpful assistant.  Answer questions.'); // exact dup after normalization
index.add('You are a code reviewer.');                        // unique

console.log(index.stats());
// { totalAdded: 3, uniqueGroups: 2, duplicatesFound: 1, deduplicationRate: 0.333..., memoryUsageBytes: ... }
```

---

## Features

- **Configurable normalization pipeline** -- Six independently toggleable steps applied in fixed order: whitespace, case, variables, section-order, example-order, and formatting.
- **Content hashing** -- Normalized hash (primary dedup key), structural hash (organizational skeleton), and per-section hashes for partial matching. SHA-256 (default) and xxHash64 algorithms.
- **Composite similarity scoring** -- Weighted combination of Jaccard similarity, n-gram shingling, normalized edit distance, and structural similarity for robust near-duplicate detection.
- **In-memory dedup index** -- `DedupIndex` class for batch deduplication with O(1) exact hash lookups and configurable near-duplicate scanning with FIFO eviction.
- **Multiple prompt formats** -- Plain text strings, OpenAI-style message arrays (`{role, content}[]`), Anthropic-style prompt objects (`{system, messages}`), and file path inputs.
- **Template variable extraction** -- Auto-detects Handlebars (`{{var}}`), Jinja2 (`{{ var }}`), f-string (`{var}`), and dollar (`$var`, `${var}`) syntax. Replaces variables with canonical numbered placeholders so templates with different variable names produce the same hash.
- **Protected regions** -- Code blocks and quoted strings are preserved during normalization. Template variables inside code blocks are never replaced.
- **Serialization** -- `DedupIndex` can be serialized to JSON and restored via `DedupIndex.deserialize()` for persistence across sessions.
- **Zero runtime dependencies** -- Built entirely on Node.js built-in modules (`node:crypto`, `node:fs`).
- **TypeScript-first** -- Full type definitions shipped with the package.

---

## API Reference

### `normalize(prompt, options?): string`

Normalizes a prompt through the configurable pipeline and returns the canonical form string.

```typescript
function normalize(prompt: PromptInput, options?: NormalizeOptions): string;
```

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `prompt` | `PromptInput` | The prompt to normalize. Accepts a plain string, OpenAI message array, Anthropic prompt object, or `{ file: string }`. |
| `options` | `NormalizeOptions` | Optional. Configure which normalization steps are enabled and the template syntax. |

**Returns:** The canonical form of the prompt as a string.

```typescript
normalize('You are a helpful assistant.\n\n\n   Answer questions.   ');
// => "You are a helpful assistant.\n\nAnswer questions."

normalize('Hello {{user_name}}, your order {{order_id}} is ready.');
// => "Hello {{VAR_0}}, your order {{VAR_1}} is ready."

normalize([
  { role: 'system', content: 'You are   helpful.' },
  { role: 'user', content: 'Hello   world.' },
]);
// => "[system]\nYou are helpful.\n\n[user]\nHello world."
```

---

### `hash(prompt, options?): HashResult`

Normalizes a prompt and computes content hashes. Returns a `HashResult` containing the normalized hash, structural hash, per-section hashes, canonical form, algorithm used, normalization steps applied, and processing duration.

```typescript
function hash(prompt: PromptInput, options?: HashOptions): HashResult;
```

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `prompt` | `PromptInput` | The prompt to hash. |
| `options` | `HashOptions` | Optional. Extends `NormalizeOptions` with `algorithm` (`'sha256'` or `'xxhash64'`). |

**Returns:** `HashResult`

| Field | Type | Description |
|-------|------|-------------|
| `normalized` | `string` | Hash of the fully normalized prompt. Primary dedup key. 64-char hex for SHA-256, 16-char hex for xxHash64. |
| `structural` | `string` | Hash of the structural skeleton (roles, headers, variable placeholders). |
| `sections` | `string[]` | Per-section hashes, one per detected section. |
| `canonicalForm` | `string` | The normalized text of the prompt. |
| `algorithm` | `'sha256' \| 'xxhash64'` | The hash algorithm used. |
| `stepsApplied` | `string[]` | Names of the normalization steps that were applied. |
| `durationMs` | `number` | Wall-clock time for normalization and hashing in milliseconds. |

```typescript
const result = hash('You are a helpful assistant. Answer questions.');
console.log(result.normalized);   // "a1b2c3d4..." (64-char SHA-256 hex)
console.log(result.structural);   // "f7e8d9c0..." (structural skeleton hash)
console.log(result.sections);     // ["abc123...", "def456..."]
console.log(result.stepsApplied); // ["whitespace", "variables", "formatting"]

// Prompts differing only in whitespace produce the same hash
const a = hash('You are helpful.\n\nAnswer questions.');
const b = hash('You are helpful.\n\n\n   Answer questions.   ');
a.normalized === b.normalized; // true

// Use xxHash64 for faster hashing
const fast = hash('prompt text', { algorithm: 'xxhash64' });
console.log(fast.normalized); // 16-char hex string
```

---

### `similarity(promptA, promptB, options?): SimilarityResult`

Computes a composite similarity score between two prompts. The score is a weighted combination of four independent metrics.

```typescript
function similarity(
  promptA: PromptInput,
  promptB: PromptInput,
  options?: SimilarityOptions,
): SimilarityResult;
```

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `promptA` | `PromptInput` | First prompt. |
| `promptB` | `PromptInput` | Second prompt. |
| `options` | `SimilarityOptions` | Optional. Configure weights, shingle size, threshold, and max edit distance length. |

**Returns:** `SimilarityResult`

| Field | Type | Description |
|-------|------|-------------|
| `score` | `number` | Composite similarity score from 0.0 to 1.0. |
| `jaccard` | `number` | Token-level Jaccard similarity (word set overlap). |
| `shingle` | `number` | N-gram shingling similarity (phrase-level overlap). |
| `editDistance` | `number` | Normalized Levenshtein edit distance similarity. |
| `structural` | `number` | Structural similarity (roles, sections, variables, examples). |
| `isDuplicate` | `boolean` | `true` if `score >= threshold`. |
| `threshold` | `number` | The threshold used for classification. |
| `durationMs` | `number` | Wall-clock time in milliseconds. |

**Default weights:** `{ jaccard: 0.30, shingle: 0.30, edit: 0.20, structure: 0.20 }`

```typescript
const result = similarity(
  'You are a helpful assistant. Answer questions clearly.',
  'You are a helpful assistant. Answer questions concisely.',
);
console.log(result.score);        // e.g. 0.87
console.log(result.isDuplicate);  // true (score >= 0.85)
console.log(result.jaccard);      // individual metric score
console.log(result.shingle);      // individual metric score
console.log(result.editDistance);  // individual metric score
console.log(result.structural);   // individual metric score
```

---

### `isDuplicate(promptA, promptB, options?): boolean`

Convenience function that returns `true` if two prompts are near-duplicates based on their composite similarity score.

```typescript
function isDuplicate(
  promptA: PromptInput,
  promptB: PromptInput,
  options?: SimilarityOptions,
): boolean;
```

```typescript
isDuplicate('You are helpful.', 'You are   helpful.');           // true
isDuplicate('You are a code reviewer.', 'You are a translator.'); // false

// Custom threshold
isDuplicate('prompt A', 'prompt B', { threshold: 0.70 });
```

---

### `createIndex(options?): DedupIndex`

Factory function that creates a new `DedupIndex` for batch deduplication.

```typescript
function createIndex(options?: IndexOptions): DedupIndex;
```

**`IndexOptions`:**

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `threshold` | `number` | `0.85` | Similarity threshold for grouping duplicates. |
| `maxSize` | `number` | `100000` | Maximum number of entries the index can hold. Oldest entries are evicted (FIFO) when exceeded. |
| `nearDuplicateDetection` | `boolean` | `true` | When `false`, only exact hash matching is used (no similarity scanning). |
| `algorithm` | `'sha256' \| 'xxhash64'` | `'sha256'` | Hash algorithm for content hashing. |
| `steps` | `object` | See below | Normalization step configuration (inherited from `NormalizeOptions`). |
| `templateSyntax` | `string` | `'auto'` | Template syntax for variable extraction (inherited from `NormalizeOptions`). |

---

### `DedupIndex`

In-memory dedup index for efficient batch deduplication.

#### `index.add(prompt, metadata?): AddResult`

Adds a prompt to the index. If the prompt is an exact or near-duplicate of an existing entry, it is assigned to the same group.

```typescript
add(prompt: PromptInput, metadata?: Record<string, unknown>): AddResult;
```

**Returns:** `AddResult`

| Field | Type | Description |
|-------|------|-------------|
| `hash` | `string` | The normalized hash of the added prompt. |
| `isDuplicate` | `boolean` | Whether this prompt matched an existing entry. |
| `duplicateOf` | `string \| undefined` | Hash of the matched entry (if `isDuplicate`). |
| `similarity` | `number \| undefined` | Similarity score with the matched entry (if `isDuplicate`). |
| `groupId` | `string` | The dedup group ID this prompt was assigned to. |

```typescript
const index = createIndex();
const r1 = index.add('You are a helpful assistant.');
// { hash: "abc...", isDuplicate: false, groupId: "g1" }

const r2 = index.add('You are a helpful assistant.');
// { hash: "abc...", isDuplicate: true, duplicateOf: "abc...", similarity: 1.0, groupId: "g1" }

// Attach metadata to entries
index.add('Review this code.', { source: 'code-review-app', version: 2 });
```

#### `index.find(prompt): FindResult | null`

Queries the index for the nearest match without adding the prompt to the index.

```typescript
find(prompt: PromptInput): FindResult | null;
```

**Returns:** `FindResult | null`

| Field | Type | Description |
|-------|------|-------------|
| `hash` | `string` | Hash of the nearest match. |
| `similarity` | `number` | Similarity score with the nearest match. |
| `groupId` | `string` | Group ID of the nearest match. |
| `canonicalForm` | `string` | Canonical form of the nearest match. |

Returns `null` if no match is found above the threshold.

```typescript
const match = index.find('You are a helpful assistant.');
if (match) {
  console.log(match.similarity); // 1.0
  console.log(match.groupId);    // "g1"
}
```

#### `index.groups(): DedupGroup[]`

Returns all dedup groups.

```typescript
interface DedupGroup {
  groupId: string;     // Unique group identifier (e.g. "g1")
  canonical: string;   // Hash of the canonical (first-added) member
  members: string[];   // Hashes of all members in the group
  count: number;       // Number of members
}
```

#### `index.duplicateGroups(): DedupGroup[]`

Returns only groups that contain more than one member (i.e., groups with actual duplicates).

#### `index.stats(): DedupStats`

Returns deduplication statistics.

```typescript
interface DedupStats {
  totalAdded: number;        // Total prompts added
  uniqueGroups: number;      // Number of unique groups
  duplicatesFound: number;   // Number of duplicates detected
  deduplicationRate: number; // duplicatesFound / totalAdded
  memoryUsageBytes: number;  // Estimated memory usage
}
```

```typescript
const stats = index.stats();
console.log(stats.deduplicationRate); // e.g. 0.333
```

#### `index.size(): number`

Returns the number of entries currently in the index.

#### `index.clear(): void`

Removes all entries, groups, and resets all counters.

#### `index.serialize(): SerializedIndex`

Serializes the index to a JSON-compatible object for persistence.

```typescript
interface SerializedIndex {
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
```

#### `DedupIndex.deserialize(data, options?): DedupIndex`

Static method that restores a `DedupIndex` from a serialized object.

```typescript
static deserialize(data: SerializedIndex, options?: IndexOptions): DedupIndex;
```

```typescript
// Persist to disk
const serialized = index.serialize();
fs.writeFileSync('index.json', JSON.stringify(serialized));

// Restore later
const data = JSON.parse(fs.readFileSync('index.json', 'utf-8'));
const restored = DedupIndex.deserialize(data);
const match = restored.find('You are a helpful assistant.');
```

---

## Configuration

### Normalization Steps

The normalization pipeline applies steps in a fixed order. Each step can be individually enabled or disabled.

| Step | Order | Default | Description |
|------|-------|---------|-------------|
| `whitespace` | 1 | enabled | Collapse whitespace sequences, trim lines, normalize line endings to `\n`, collapse multiple blank lines. Preserves whitespace inside fenced code blocks. |
| `case` | 2 | disabled | Convert non-protected text to lowercase. Preserves code blocks, quoted strings, and identifiers (camelCase, PascalCase, SCREAMING_SNAKE_CASE, kebab-case). |
| `variables` | 3 | enabled | Detect template variables and replace with canonical placeholders (`{{VAR_0}}`, `{{VAR_1}}`, ...). Supports auto-detection of Handlebars, Jinja2, f-string, and dollar syntax. Skips code blocks and JSON/object literals. |
| `section-order` | 4 | disabled | Detect sections (markdown headers, XML tags, labeled blocks) and sort alphabetically by title. Content within each section is preserved. |
| `example-order` | 5 | disabled | Detect few-shot examples and sort by content hash (SHA-256 of normalized text) for deterministic ordering. |
| `formatting` | 6 | enabled | Strip markdown formatting (bold, italic, strikethrough), normalize list markers to `-`, normalize numbered list markers to `N.`, remove horizontal rules. Preserves code blocks and heading levels. |

```typescript
normalize(prompt, {
  steps: {
    whitespace: true,       // default: true
    case: true,             // default: false
    variables: true,        // default: true
    'section-order': true,  // default: false
    'example-order': true,  // default: false
    formatting: true,       // default: true
  },
  templateSyntax: 'handlebars', // 'auto' | 'handlebars' | 'jinja2' | 'fstring' | 'dollar'
});
```

### Template Syntax

The `templateSyntax` option controls how template variables are detected:

| Value | Pattern | Example |
|-------|---------|---------|
| `'auto'` (default) | Auto-detect from content | Inspects text and selects the best match |
| `'handlebars'` | `{{variable}}` | `Hello {{name}}` |
| `'jinja2'` | `{{ variable }}` | `Hello {{ name }}` |
| `'fstring'` | `{variable}` | `Hello {name}` |
| `'dollar'` | `$variable` or `${variable}` | `Hello $name` or `Hello ${name}` |

### Similarity Weights

Custom weights must sum to 1.0:

```typescript
similarity(promptA, promptB, {
  weights: {
    jaccard: 0.40,    // default: 0.30
    shingle: 0.30,    // default: 0.30
    edit: 0.20,       // default: 0.20
    structure: 0.10,  // default: 0.20
  },
  shingleSize: 3,              // n-gram size, default: 3
  threshold: 0.85,             // duplicate threshold, default: 0.85
  maxEditDistanceLength: 10000, // fallback to prefix/suffix estimate above this, default: 10000
});
```

### Recommended Thresholds

| Use Case | Threshold |
|----------|-----------|
| Cache key dedup (conservative) | 0.95 |
| Prompt registry dedup | 0.85 |
| Prompt analytics grouping | 0.70 |
| Broad similarity detection | 0.60 |

---

## Error Handling

All functions handle edge cases gracefully without throwing:

- **Empty strings** normalize to `''`, hash deterministically, and have similarity `1.0` with each other.
- **Whitespace-only strings** normalize to `''`.
- **Prompts with no template variables** pass through variable extraction unchanged.
- **Prompts shorter than the shingle size** are handled by using the full text as a single shingle.
- **Prompts exceeding `maxEditDistanceLength`** (default 10,000 characters) use a fast prefix/suffix matching estimate instead of full Levenshtein computation, keeping latency under 2ms.
- **File inputs** (`{ file: string }`) read the file synchronously. If the file does not exist or cannot be read, Node.js will throw its standard `ENOENT` error.
- **Invalid prompt formats** that are not a recognized type are coerced to a string via `String(input)`.

---

## Advanced Usage

### Cache Key Normalization

Use normalized hashes as cache keys for LLM response caches. Prompts that differ only in whitespace, formatting, or variable names produce the same hash:

```typescript
import { hash } from 'prompt-dedup';

function getCacheKey(prompt: string): string {
  return hash(prompt).normalized;
}

// These all produce the same cache key:
getCacheKey('You are helpful.\n\nAnswer questions.');
getCacheKey('You are helpful.\n\n\n   Answer questions.   ');
getCacheKey('You are helpful.\r\n\r\nAnswer questions.');
```

### Template Deduplication

Templates with different variable names but identical structure produce the same hash:

```typescript
import { hash } from 'prompt-dedup';

const a = hash('Hello {{user_name}}, order {{order_id}} ready.');
const b = hash('Hello {{name}}, order {{id}} ready.');
a.normalized === b.normalized; // true
```

### Prompt Registry Deduplication

Scan a collection of prompts to find duplicate groups:

```typescript
import { createIndex } from 'prompt-dedup';

const index = createIndex({ threshold: 0.85 });

const prompts = [
  'You are a helpful assistant. Answer questions.',
  'You are a helpful assistant.  Answer questions.',
  'You are a code reviewer. Review code for bugs.',
  'You are a code reviewer. Review code for issues.',
  'Translate the following text to French.',
];

for (const p of prompts) {
  index.add(p);
}

// Find groups with duplicates
for (const group of index.duplicateGroups()) {
  console.log(`Group ${group.groupId}: ${group.count} members`);
}

console.log(index.stats());
```

### Structural Hash for Template Grouping

Use the structural hash to group prompts by organizational shape, regardless of instructional content:

```typescript
import { hash } from 'prompt-dedup';

const a = hash('## Instructions\nDo task A\n\n## Examples\nExample A');
const b = hash('## Instructions\nDo task B\n\n## Examples\nExample B');
a.structural === b.structural; // true -- same structure, different text
```

### Index Persistence

Serialize and restore the index across sessions:

```typescript
import { createIndex, DedupIndex } from 'prompt-dedup';
import fs from 'node:fs';

// Build and persist
const index = createIndex();
index.add('Prompt one.');
index.add('Prompt two.');
fs.writeFileSync('dedup-index.json', JSON.stringify(index.serialize()));

// Restore
const data = JSON.parse(fs.readFileSync('dedup-index.json', 'utf-8'));
const restored = DedupIndex.deserialize(data);
console.log(restored.size()); // 2
```

### OpenAI Message Array Input

```typescript
import { hash, similarity } from 'prompt-dedup';

const messages = [
  { role: 'system' as const, content: 'You are a helpful assistant.' },
  { role: 'user' as const, content: 'What is the weather?' },
];

const result = hash(messages);
console.log(result.normalized); // hash of the concatenated message content
```

### Anthropic Prompt Input

```typescript
import { hash } from 'prompt-dedup';

const result = hash({
  system: 'You are a helpful assistant.',
  messages: [
    { role: 'user', content: 'Hello.' },
    { role: 'assistant', content: 'Hi there!' },
  ],
});
console.log(result.normalized);
```

### Disabling Near-Duplicate Detection

For maximum speed when you only need exact-match deduplication:

```typescript
const index = createIndex({
  nearDuplicateDetection: false, // only exact hash matching, O(1)
});
```

### FIFO Eviction

When the index exceeds `maxSize`, the oldest entries are automatically evicted:

```typescript
const index = createIndex({ maxSize: 1000 });
// After adding 1001 entries, the oldest entry is evicted
```

---

## TypeScript

`prompt-dedup` is written in TypeScript and ships type declarations (`dist/index.d.ts`). All public types are exported:

```typescript
import type {
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
} from 'prompt-dedup';
```

### `PromptInput`

```typescript
type PromptInput =
  | string
  | PromptMessage[]
  | AnthropicPrompt
  | { file: string };
```

### `PromptMessage`

```typescript
interface PromptMessage {
  role: 'system' | 'user' | 'assistant' | 'developer';
  content: string;
}
```

### `AnthropicPrompt`

```typescript
interface AnthropicPrompt {
  system: string;
  messages: Array<{ role: 'user' | 'assistant'; content: string }>;
}
```

### `NormalizeOptions`

```typescript
interface NormalizeOptions {
  steps?: {
    whitespace?: boolean;
    case?: boolean;
    variables?: boolean;
    'section-order'?: boolean;
    'example-order'?: boolean;
    formatting?: boolean;
  };
  templateSyntax?: 'auto' | 'handlebars' | 'jinja2' | 'fstring' | 'dollar';
}
```

### `HashOptions`

```typescript
interface HashOptions extends NormalizeOptions {
  algorithm?: 'sha256' | 'xxhash64';
}
```

### `SimilarityOptions`

```typescript
interface SimilarityOptions extends NormalizeOptions {
  weights?: {
    jaccard?: number;
    shingle?: number;
    edit?: number;
    structure?: number;
  };
  shingleSize?: number;
  threshold?: number;
  maxEditDistanceLength?: number;
}
```

### `IndexOptions`

```typescript
interface IndexOptions extends HashOptions {
  threshold?: number;
  maxSize?: number;
  nearDuplicateDetection?: boolean;
}
```

---

## License

MIT
