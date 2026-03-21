# prompt-dedup

Detect near-duplicate LLM prompts via content hashing and similarity scoring.

Normalizes prompt text through a configurable pipeline -- collapsing whitespace, extracting template variables, ordering sections, stripping formatting -- then computes content hashes and similarity scores to determine whether two prompts are duplicates, near-duplicates, or distinct.

Zero runtime dependencies. Runs in milliseconds.

## Install

```bash
npm install prompt-dedup
```

## Quick Start

```typescript
import { normalize, hash, similarity, isDuplicate, createIndex } from 'prompt-dedup';

// Normalize a prompt to its canonical form
const canonical = normalize('You are a helpful assistant.\n\n\n   Answer questions.   ');
// "You are a helpful assistant.\n\nAnswer questions."

// Hash a prompt for cache key usage
const result = hash('You are a helpful assistant. Answer questions.');
console.log(result.normalized);  // 64-char SHA-256 hex string

// Compare two prompts
const sim = similarity(
  'You are a helpful assistant. Answer questions clearly.',
  'You are a helpful assistant. Answer questions concisely.',
);
console.log(sim.score);       // 0.0 - 1.0
console.log(sim.isDuplicate); // true if score >= threshold

// Quick duplicate check
isDuplicate('You are helpful.', 'You are   helpful.'); // true

// Batch deduplication
const index = createIndex({ threshold: 0.85 });
index.add('You are a helpful assistant. Answer questions.');
index.add('You are a helpful assistant.  Answer questions.'); // duplicate
index.add('You are a code reviewer.');                        // unique

console.log(index.stats());
// { totalAdded: 3, uniqueGroups: 2, duplicatesFound: 1, deduplicationRate: 0.333, ... }
```

## API

### `normalize(prompt, options?): string`

Normalizes a prompt through the configurable pipeline and returns the canonical form.

**Parameters:**
- `prompt` - `string | PromptMessage[] | AnthropicPrompt | { file: string }`
- `options` - `NormalizeOptions` (optional)

### `hash(prompt, options?): HashResult`

Normalizes a prompt and computes content hashes.

**Returns:**
- `normalized` - SHA-256 (or xxhash64) hash of the normalized prompt
- `structural` - Hash of the structural skeleton
- `sections` - Per-section hashes
- `canonicalForm` - The normalized text
- `algorithm` - Hash algorithm used
- `stepsApplied` - Normalization steps that were applied
- `durationMs` - Processing time

### `similarity(promptA, promptB, options?): SimilarityResult`

Computes a composite similarity score (0.0 to 1.0) between two prompts.

The score is a weighted combination of:
- **Jaccard similarity** (0.30) - Token-level word overlap
- **Shingle similarity** (0.30) - N-gram phrase overlap
- **Edit distance** (0.20) - Character-level similarity
- **Structural similarity** (0.20) - Organizational structure match

### `isDuplicate(promptA, promptB, options?): boolean`

Returns `true` if two prompts are near-duplicates (similarity >= threshold).

### `createIndex(options?): DedupIndex`

Creates an in-memory dedup index for batch deduplication.

**DedupIndex methods:**
- `add(prompt, metadata?)` - Add a prompt, returns `AddResult` with duplicate info
- `find(prompt)` - Find nearest match without adding, returns `FindResult | null`
- `groups()` - Get all dedup groups
- `duplicateGroups()` - Get groups with duplicates
- `stats()` - Get dedup statistics
- `size()` - Entry count
- `clear()` - Reset the index
- `serialize()` / `DedupIndex.deserialize(data)` - Persistence

## Normalization Steps

| Step | Default | Description |
|------|---------|-------------|
| `whitespace` | enabled | Collapse whitespace, trim, normalize line endings |
| `case` | disabled | Lowercase non-protected text |
| `variables` | enabled | Extract template variables, replace with `{{VAR_N}}` |
| `section-order` | disabled | Sort sections alphabetically |
| `example-order` | disabled | Sort few-shot examples by content hash |
| `formatting` | enabled | Strip markdown formatting, normalize list markers |

Configure steps via options:

```typescript
normalize(prompt, {
  steps: { case: true, 'section-order': true },
  templateSyntax: 'handlebars', // 'auto' | 'handlebars' | 'jinja2' | 'fstring' | 'dollar'
});
```

## Supported Prompt Formats

- **Plain text strings**
- **OpenAI-style message arrays**: `[{ role: 'system', content: '...' }, ...]`
- **Anthropic-style objects**: `{ system: '...', messages: [...] }`

## Use Cases

- **Cache key normalization** - Use `hash(prompt).normalized` as cache key for LLM response caches
- **Prompt registry dedup** - Use `createIndex()` to find duplicates across prompt collections
- **CI/CD gates** - Check for duplicate prompts before deployment
- **Cost optimization** - Identify redundant prompts to reduce API spend

## License

MIT
