# prompt-dedup -- Specification

## 1. Overview

`prompt-dedup` is a content hashing and similarity scoring library for detecting near-duplicate LLM prompts. It normalizes prompt text through a configurable pipeline -- collapsing whitespace, extracting template variables, ordering sections, stripping formatting -- then computes content hashes and similarity scores to determine whether two prompts are duplicates, near-duplicates, or distinct. The result is a structured verdict with a similarity score, matching hash, and deduplication group membership. An in-memory `DedupIndex` enables efficient batch deduplication across large prompt collections, returning cluster groups and dedup statistics. The primary purpose is cache-hit optimization: by normalizing prompts before using them as cache keys, applications achieve dramatically higher cache hit rates for LLM response caches, reducing both latency and API cost.

The gap this package fills is specific and well-defined. LLM applications frequently send semantically identical prompts that differ only in whitespace, variable ordering, formatting style, or inconsequential structural variations. A customer support system might send `"You are a helpful assistant.\n\nAnswer questions about our products."` from one code path and `"You are a helpful assistant.\nAnswer questions about our products."` from another -- these are functionally identical but produce different cache keys under exact string matching. Template-based systems generate prompts with variables like `{{name}} is {{age}} years old` and `{{age}} years old, {{name}}` -- same template semantics, different surface text. A prompt management platform storing thousands of prompts accumulates near-duplicates as teams independently author similar instructions. In all these cases, no existing npm package normalizes prompts and identifies duplicates at the prompt-semantic level.

Existing tools address adjacent problems but not this one. The `string-similarity` npm package (3M+ weekly downloads) computes Dice coefficient similarity between arbitrary strings but has no concept of prompt structure, template variables, or normalization pipelines. The `fastest-levenshtein` package computes edit distance at the character level but cannot recognize that two prompts with different whitespace are identical. The `natural` NLP toolkit provides tokenization and TF-IDF but is a 15MB dependency designed for general NLP, not prompt-specific deduplication. Content-addressable storage systems like git (SHA-1), IPFS (SHA-256 via CIDs), and Docker (content-addressable image layers) demonstrate the power of content hashing for deduplication, but they hash raw bytes with no normalization -- identical content at the byte level, not the semantic level. Google's SimHash technique detects near-duplicate web pages by computing 64-bit fingerprints where similar documents produce fingerprints with small Hamming distance, but SimHash operates on bag-of-words features and has no awareness of prompt-specific structure like roles, sections, or template variables. MinHash with Locality-Sensitive Hashing (LSH), pioneered by Andrei Broder in 1997 for AltaVista's duplicate web page detection, estimates Jaccard similarity on shingle sets efficiently but again treats documents as flat text.

`prompt-dedup` is designed specifically for LLM prompts. It understands that `{{name}}` and `{{user_name}}` are template variables that should be replaced with canonical placeholders before comparison. It knows that collapsing three blank lines into one does not change prompt semantics. It recognizes that a system message followed by a user message is structurally different from a single flat prompt, even if the concatenated text is the same. It applies a configurable normalization pipeline before hashing, ensuring that semantically identical prompts produce identical hashes regardless of cosmetic differences.

The package also differs from `llm-dedup` in this same monorepo. `llm-dedup` coalesces semantically similar in-flight LLM requests at runtime -- it intercepts concurrent API calls and deduplicates them by returning a single response to multiple callers. `prompt-dedup` operates at the prompt content level before any API call is made: it normalizes, hashes, and scores prompts to determine whether they are duplicates, enabling caching layers and prompt management systems to group and deduplicate prompts. The two packages are complementary: `prompt-dedup` deduplicates prompt content for cache key generation, while `llm-dedup` deduplicates in-flight requests for concurrent call coalescing.

`prompt-dedup` provides both a TypeScript/JavaScript API for programmatic use and a CLI for terminal and shell-script use. The API returns structured results with hashes, similarity scores, dedup verdicts, and group memberships. The CLI prints human-readable or JSON output for batch dedup analysis across prompt files. Both interfaces support configurable normalization steps, similarity thresholds, and hash algorithm selection. The package has zero runtime dependencies and runs in milliseconds.

---

## 2. Goals and Non-Goals

### Goals

- Provide a `normalize(prompt)` function that applies a configurable pipeline of normalization steps to produce a canonical form of the prompt, suitable for hashing and comparison.
- Provide a `hash(prompt, options?)` function that normalizes the prompt and computes a content hash, returning a deterministic string identifier for that prompt's semantic content.
- Provide a `similarity(promptA, promptB, options?)` function that computes a composite similarity score (0.0 to 1.0) between two prompts, combining token-level Jaccard similarity, n-gram shingling, and structural similarity.
- Provide an `isDuplicate(promptA, promptB, threshold?)` function that returns a boolean verdict on whether two prompts are near-duplicates, based on a configurable similarity threshold.
- Provide a `createIndex()` factory that returns a `DedupIndex` for efficient batch deduplication -- adding prompts incrementally, detecting duplicates on insertion, querying for nearest matches, and retrieving duplicate groups.
- Normalize prompts through a pipeline of configurable steps: whitespace normalization, case normalization, template variable extraction and placeholder replacement, section ordering normalization, few-shot example ordering normalization, and formatting normalization.
- Support multiple hash algorithms: SHA-256 for collision resistance and compatibility, and xxHash (xxHash64) for speed in high-throughput scenarios. Default to SHA-256.
- Compute multiple hash types per prompt: a normalized hash (hash of the fully normalized prompt), a structural hash (hash of the prompt's structural skeleton only), and per-section hashes for partial matching.
- Support multiple prompt formats: plain text strings, OpenAI-style message arrays (`{role, content}[]`), and Anthropic-style prompt objects (`{system, messages}`).
- Provide a CLI (`prompt-dedup`) for batch deduplication analysis across prompt files and directories.
- Keep dependencies at zero. All functionality uses Node.js built-in modules. No external hashing library, no NLP library, no CLI framework.
- Integrate with the prompt engineering ecosystem: use normalized hashes as cache keys for LLM response caches, integrate with `prompt-optimize` for pre-optimization dedup, and provide structured output for prompt analytics dashboards.
- Run in milliseconds. Normalizing and hashing a typical prompt (1-10 KB) completes in under 1ms. Similarity scoring between two prompts completes in under 2ms. Index lookups against 10,000 indexed prompts complete in under 5ms.

### Non-Goals

- **Not a semantic similarity engine.** This package does not use embedding models, LLMs, or any form of neural inference to assess whether two prompts mean the same thing. It uses deterministic text normalization and token-level comparison. "List 5 items" and "Give me five items" are semantically equivalent but textually different; `prompt-dedup` will report them as distinct (low similarity score) because it does not understand paraphrase equivalence. Embedding-based dedup requires API calls, costs money, is non-deterministic, and introduces latency. `prompt-dedup` is fast, free, offline, and deterministic.
- **Not a response cache.** This package does not cache LLM responses. It provides hash functions and similarity scores that caching layers can use as keys. The cache implementation itself (storage, eviction, TTL, persistence) is the responsibility of the consuming application or a dedicated caching library.
- **Not an in-flight request deduplicator.** This package does not intercept or coalesce concurrent API calls. That is what `llm-dedup` does. `prompt-dedup` operates on prompt content at rest, not on requests in flight.
- **Not a prompt optimizer.** This package normalizes prompts for comparison purposes but does not optimize them for token efficiency. The normalized form is an internal representation for hashing and similarity, not a production-ready optimized prompt. Use `prompt-optimize` for token reduction.
- **Not a prompt diff engine.** This package determines whether two prompts are duplicates and reports a similarity score, but it does not produce a structural diff showing what changed between them. That is what `prompt-diff` does. The two are complementary: `prompt-dedup` answers "are these the same?", `prompt-diff` answers "how are these different?"
- **Not a plagiarism detector.** While the similarity scoring could be used for plagiarism detection, the normalization pipeline is tuned for prompt-specific patterns (template variables, role markers, section headers), not for general academic text comparison.

---

## 3. Target Users and Use Cases

### LLM Response Cache Operators

Teams operating response caches for LLM API calls (Redis-backed, in-memory, or disk-based). The cache key is typically a hash of the prompt. Without normalization, prompts that differ only in whitespace, variable ordering, or formatting produce different cache keys and miss the cache. By normalizing prompts with `prompt-dedup` before hashing, cache operators achieve significantly higher hit rates. A system serving 1 million requests per day with a 60% cache hit rate at $3/MTok on 500-token prompts spends $600/day on cache misses. If normalization increases the hit rate to 75%, that drops to $375/day -- $82,125/year in savings from better cache keys alone.

### Prompt Management Platforms

Teams maintaining prompt registries and libraries used across multiple applications. As organizations grow, different teams independently author similar prompts for overlapping use cases. A support team writes "You are a customer support assistant. Answer questions about our products." while a sales team writes "You are a helpful customer service agent. Answer questions about our product catalog." Running `prompt-dedup` across the registry identifies these near-duplicates, enabling consolidation and reducing maintenance burden. The `index.groups()` API returns clusters of duplicates for review.

### Cost Optimization Engineers

Engineers tasked with reducing LLM API spend. Before optimizing individual prompts with `prompt-optimize`, they need to know how many prompts in their system are near-duplicates. `prompt-dedup --analyze ./prompts/` produces a report showing duplicate groups, potential cache-hit improvement from normalization, and the number of unique prompts after deduplication. This data informs the cost optimization strategy: dedup first, then optimize each unique prompt.

### CI/CD Pipeline Operators

Teams that gate prompt deployments on deduplication checks. A CI step runs `prompt-dedup --check ./prompts/` and fails the build if a new prompt is a near-duplicate of an existing one, preventing prompt proliferation. The threshold is configurable: "fail if any two prompts have similarity above 0.85."

### AI Application Developers

Developers building applications that template prompts with user-provided variables. The same template instantiated with different variable values should produce the same cache key (after variable extraction). `prompt-dedup` extracts variables, replaces them with canonical placeholders, and hashes the template -- ensuring cache hits regardless of the specific variable values. A chatbot template `"Help {{user_name}} with their {{issue_type}} question"` produces the same hash whether `user_name` is "Alice" or "Bob".

### Prompt Analytics and Observability

Teams building observability dashboards for LLM usage. Grouping API calls by normalized prompt hash reveals the true distribution of unique prompts in production. Without normalization, the dashboard shows thousands of "unique" prompts that are actually minor variants of a few dozen templates. With normalization, the dashboard accurately shows 47 unique prompt templates accounting for all traffic, enabling focused optimization.

---

## 4. Core Concepts

### Normalization Pipeline

The normalization pipeline is the central mechanism of `prompt-dedup`. It transforms a raw prompt into a canonical form by applying a sequence of normalization steps, each of which eliminates a specific class of cosmetic variation. The pipeline is configurable: each step can be enabled or disabled, and the steps execute in a fixed order. The output of the pipeline is a normalized string that serves as the input to hashing and similarity functions.

The pipeline design follows the principle of content-addressable storage (CAS), where identical content produces identical identifiers. Git hashes file content to SHA-1, producing the same hash for identical files regardless of filename, path, or commit. IPFS produces Content Identifiers (CIDs) by hashing data blocks with SHA-256, ensuring that identical data is stored once and addressed by its content. `prompt-dedup` applies the same principle to prompt text, but with a normalization layer that defines "identical content" more broadly than byte-level equality: two prompts are content-identical if they normalize to the same string.

### Content Hash

A content hash is a fixed-length string produced by passing the normalized prompt through a hash function. Two prompts that normalize to the same string produce the same content hash. The hash serves as a unique identifier for the prompt's semantic content, suitable for use as a cache key, database lookup key, or dedup group identifier.

`prompt-dedup` supports two hash algorithms:

- **SHA-256**: Cryptographic hash producing a 64-character hex string. Collision-resistant (no known collisions). Standard choice for content-addressable systems. Slower than non-cryptographic alternatives but fast enough for prompt-length inputs (under 0.1ms for a 10 KB prompt).
- **xxHash64**: Non-cryptographic hash producing a 16-character hex string. Designed for speed, processing at RAM bandwidth limits. Suitable for high-throughput scenarios where collision resistance is less critical than speed. Approximately 5-10x faster than SHA-256 for typical prompt lengths.

### Similarity Score

A similarity score is a floating-point number between 0.0 (completely different) and 1.0 (identical after normalization) that quantifies how similar two prompts are. The score is computed as a weighted combination of multiple similarity metrics: token-level Jaccard similarity, n-gram shingling similarity, normalized edit distance, and structural similarity. The composite score provides a more robust measure than any single metric alone.

### Dedup Verdict

A dedup verdict is the binary classification of two prompts as either "duplicate" or "distinct", determined by comparing the similarity score against a configurable threshold. The default threshold is 0.85: prompts with a composite similarity score at or above 0.85 are classified as near-duplicates. The threshold is tunable based on the use case: caching layers may use a higher threshold (0.95) for conservative dedup, while prompt analytics may use a lower threshold (0.70) for broader grouping.

### Dedup Group

A dedup group is a cluster of prompts that are all near-duplicates of each other. When prompts are added to a `DedupIndex`, each prompt is assigned to an existing group (if it matches a group member above the similarity threshold) or starts a new group. The first prompt added to a group becomes the canonical representative. Groups enable batch operations: "show me all groups with more than one member" reveals all duplicates in a collection.

### Canonical Form

The canonical form is the normalized representation of a prompt after the full normalization pipeline has been applied. It is the string that is hashed to produce the content hash. The canonical form is deterministic: the same raw prompt always produces the same canonical form. The canonical form is not intended for human consumption or for sending to an LLM -- it is an internal representation optimized for comparison and hashing.

---

## 5. Normalization Pipeline

The normalization pipeline applies a fixed sequence of steps to transform raw prompt text into a canonical form. Each step targets a specific class of cosmetic variation. Steps execute in order; each step operates on the output of the previous step. Each step is independently configurable (enable/disable).

### 5.1 Whitespace Normalization

**Step ID**: `whitespace`

**What it does**: Collapses all forms of whitespace variation into a canonical representation. Specifically: replaces all sequences of whitespace characters (spaces, tabs, `\r\n`, `\r`, `\n`) with a single space within each line, trims leading and trailing whitespace from each line, collapses multiple consecutive blank lines into a single blank line, removes leading and trailing blank lines from the entire prompt, and normalizes line endings to `\n`.

**Why**: Whitespace is the most common source of false cache misses. The same prompt copied from an IDE includes trailing spaces; the same prompt loaded from a YAML file has different indentation; the same prompt on Windows has `\r\n` line endings while Linux has `\n`. LLM behavior is not affected by whitespace variations in instructional text. Anthropic's prompt caching requires exact prefix matches -- even a single extra space breaks the cache. OpenAI's automatic prefix caching similarly requires exact token-level prefix matches. Normalizing whitespace before hashing ensures these cosmetic differences do not produce different cache keys.

**What it never touches**: Whitespace inside fenced code blocks (triple backticks), which may be semantically significant for code formatting examples.

**Configurable**: Yes. Enabled by default.

**Example**:
```
Before:
"You are a helpful assistant.\r\n\r\n\r\n   Answer questions clearly.   \n\n\n"

After:
"You are a helpful assistant.\n\nAnswer questions clearly."
```

---

### 5.2 Case Normalization

**Step ID**: `case`

**What it does**: Converts all non-protected text to lowercase. Protected text includes content inside code blocks, template variable names, quoted strings, and content that appears to be an identifier (camelCase, PascalCase, SCREAMING_SNAKE_CASE, kebab-case patterns).

**Why**: Some prompt variations differ only in capitalization: "You are a Helpful Assistant" vs. "You are a helpful assistant". These are semantically identical for LLM instruction purposes. Lowercasing enables matching across capitalization variants.

**What it never touches**: Template variable names (`{{userName}}` stays as-is inside the variable extraction step), code blocks, quoted strings, acronyms and identifiers, and proper nouns that are part of role definitions (detected by adjacency to "You are a" patterns).

**Configurable**: Yes. Disabled by default. Case normalization is aggressive -- it can cause false matches between prompts that use capitalization for emphasis ("NEVER do this" vs "never do this"). Users who want it must opt in.

**Example**:
```
Before:
"You are a Helpful Assistant. Answer Questions CLEARLY."

After (with case normalization enabled):
"you are a helpful assistant. answer questions clearly."
```

---

### 5.3 Variable Extraction and Placeholder Replacement

**Step ID**: `variables`

**What it does**: Detects template variables in the prompt text and replaces them with canonical numbered placeholders. Detection supports multiple template syntaxes: Handlebars/Mustache (`{{variable}}`), Jinja2 (`{{ variable }}`), f-string (`{variable}`), and dollar (`$variable`, `${variable}`). Each unique variable name is assigned a canonical placeholder (`{{VAR_0}}`, `{{VAR_1}}`, ...) based on order of first appearance. All occurrences of the same variable are replaced with the same placeholder.

**Why**: Template-based prompt systems instantiate the same template with different variable values. A customer support prompt `"Help {{user_name}} with their {{issue}} question"` should produce the same hash regardless of whether `user_name` is "Alice" or "Bob". By extracting variables and replacing them with canonical placeholders, the template's structure is preserved while the specific variable names are normalized. This also handles variable naming differences: `{{name}}` and `{{user_name}}` in otherwise identical prompts normalize to `{{VAR_0}}` in both cases, producing the same hash.

Additionally, this step handles the case where the same template has been instantiated with concrete values. The prompt `"Help Alice with their billing question"` will not match `"Help Bob with their shipping question"` because the concrete values are not recognized as variables. This is intentional: `prompt-dedup` deduplicates template structure, not instantiated content.

**What it never touches**: Text inside code blocks, where curly braces are part of code syntax. Text where `{}` patterns are clearly JSON or object literals (detected by adjacency to colons, commas, and other JSON syntax).

**Configurable**: Yes. Enabled by default. The template syntax can be restricted to a specific style (`handlebars`, `jinja2`, `fstring`, `dollar`) or set to `auto` (detect from content).

**Example**:
```
Before:
"Hello {{user_name}}, your order {{order_id}} is ready. Please contact {{user_name}} for details."

After:
"Hello {{VAR_0}}, your order {{VAR_1}} is ready. Please contact {{VAR_0}} for details."
```

```
Before (different variable names, same structure):
"Hello {{name}}, your order {{id}} is ready. Please contact {{name}} for details."

After (identical to above):
"Hello {{VAR_0}}, your order {{VAR_1}} is ready. Please contact {{VAR_0}} for details."
```

---

### 5.4 Section Ordering Normalization

**Step ID**: `section-order`

**What it does**: Detects logical sections in the prompt (delimited by markdown headers, XML tags, or labeled blocks) and sorts them alphabetically by their title or label. Within each section, the content is preserved exactly as-is. Sections without titles (delimited by horizontal rules or blank lines only) are left in their original relative order.

**Why**: Different authors organize the same prompt information in different orders. One writes "Instructions" then "Examples" then "Output Format"; another writes "Output Format" then "Instructions" then "Examples". The prompt's semantic content is identical; only the section order differs. LLMs process the full prompt regardless of section order, and for most use cases, reordering sections does not change model behavior. By sorting sections into a canonical order, these variants produce the same hash.

**What it never touches**: Content within sections. The internal text of each section is preserved verbatim. Only the ordering of sections relative to each other changes. Role boundaries (system/user/assistant) are never reordered -- section ordering applies only within a single role block.

**Configurable**: Yes. Disabled by default. Section reordering is a strong normalization that may cause false positives for prompts where section order is semantically significant (e.g., prompts that use section order to imply priority). Users who want it must opt in.

**Example**:
```
Before:
"## Output Format\nRespond in JSON.\n\n## Instructions\nAnalyze the code.\n\n## Examples\nExample 1: ..."

After (with section-order enabled):
"## Examples\nExample 1: ...\n\n## Instructions\nAnalyze the code.\n\n## Output Format\nRespond in JSON."
```

---

### 5.5 Example Ordering Normalization

**Step ID**: `example-order`

**What it does**: Detects few-shot examples within example sections (identified by numbered patterns like `Example 1:`, `1.`, or input/output pair markers) and sorts them by a canonical key derived from their content hash. The sort key is the SHA-256 hash of the example's normalized text, ensuring a deterministic order.

**Why**: Few-shot examples are often reordered during prompt editing. The same three examples in different orders produce different cache keys under exact matching but are functionally equivalent for most LLM tasks. Research on few-shot prompting shows that example order can influence model output in some cases, but for deduplication purposes, the question is whether two prompts are the "same prompt" -- and having the same examples in a different order qualifies as the same prompt for most dedup use cases.

**What it never touches**: The content of individual examples. Only the ordering of examples relative to each other within an example section.

**Configurable**: Yes. Disabled by default. Like section ordering, example reordering may cause false positives where example order is semantically significant.

**Example**:
```
Before:
"Example 2: Input: 'world' -> Output: 'WORLD'\nExample 1: Input: 'hello' -> Output: 'HELLO'"

After (with example-order enabled):
"Example 1: Input: 'hello' -> Output: 'HELLO'\nExample 2: Input: 'world' -> Output: 'WORLD'"
```

---

### 5.6 Formatting Normalization

**Step ID**: `formatting`

**What it does**: Strips markdown formatting markers that do not affect prompt semantics: bold (`**text**` becomes `text`), italic (`*text*` or `_text_` becomes `text`), strikethrough (`~~text~~` becomes `text`), and inline code backticks around non-code content. Normalizes list markers: `*`, `-`, `+` all become `-`. Normalizes numbered list markers: `1)`, `1.`, `(1)` all become `1.`. Removes horizontal rules (`---`, `***`, `___`).

**Why**: The same instructions formatted with or without markdown produce different strings but convey identical information to the LLM. One author writes `**Important**: Always respond in JSON` while another writes `Important: Always respond in JSON`. These are the same instruction with different visual emphasis. Stripping formatting markers enables matching across formatting styles.

**What it never touches**: Code blocks (fenced or indented), heading levels (which are structural, not decorative), and formatting within quoted strings.

**Configurable**: Yes. Enabled by default.

**Example**:
```
Before:
"**Important**: Always respond in _valid_ JSON.\n***\n- Item one\n* Item two\n+ Item three"

After:
"Important: Always respond in valid JSON.\n- Item one\n- Item two\n- Item three"
```

---

### 5.7 Step Summary Table

| Step ID | Order | Default | Description |
|---|---|---|---|
| `whitespace` | 1 | enabled | Collapse whitespace, trim, normalize line endings |
| `case` | 2 | disabled | Lowercase non-protected text |
| `variables` | 3 | enabled | Extract template variables, replace with `{{VAR_N}}` |
| `section-order` | 4 | disabled | Sort sections alphabetically by title |
| `example-order` | 5 | disabled | Sort few-shot examples by content hash |
| `formatting` | 6 | enabled | Strip markdown formatting, normalize list markers |

Steps execute in the order shown. Disabled steps are skipped. The output of the final enabled step is the canonical form.

---

## 6. Hashing

### Hash Function Selection

`prompt-dedup` supports two hash algorithms, selectable via the `algorithm` option:

**SHA-256** (default): A cryptographic hash function producing a 256-bit (64-character hex) digest. SHA-256 is the standard for content-addressable storage: IPFS uses it for Content Identifiers, Docker uses it for content-addressable image layers, and numerous backup and deduplication systems use it for block-level dedup. Its collision resistance is effectively absolute for practical purposes -- no collision has ever been found. The tradeoff is speed: SHA-256 is approximately 500 MB/s on modern hardware, which is more than sufficient for prompt-length inputs (a 10 KB prompt hashes in under 0.02ms) but slower than non-cryptographic alternatives. `prompt-dedup` uses Node.js's built-in `node:crypto` module, which delegates to OpenSSL's optimized SHA-256 implementation.

**xxHash64**: A non-cryptographic hash function producing a 64-bit (16-character hex) digest. xxHash was created by Yann Collet and is designed for maximum speed, processing data at RAM bandwidth limits -- roughly 10-30 GB/s on modern hardware, 10-50x faster than SHA-256. The tradeoff is reduced collision resistance: with a 64-bit output, the birthday bound is approximately 4 billion items before collisions become probable. For prompt deduplication scenarios with fewer than a million prompts, this is more than sufficient. `prompt-dedup` implements xxHash64 using a pure TypeScript port, avoiding native dependencies.

### Hash Types

`prompt-dedup` computes three types of hashes for each prompt, each capturing a different level of content identity:

**Normalized Hash**: The hash of the fully normalized prompt string (after all enabled pipeline steps). This is the primary dedup key. Two prompts with the same normalized hash are exact duplicates after normalization. This hash is the recommended cache key for LLM response caches.

**Structural Hash**: The hash of the prompt's structural skeleton only. The skeleton is computed by replacing all non-structural text with empty strings, preserving only role markers, section headers, template variable placeholders, and structural delimiters. Two prompts with the same structural hash have the same structure (same roles, same sections, same variable positions) but may differ in their instructional text. Structural hashes are useful for grouping prompts by template shape.

**Per-Section Hashes**: An array of hashes, one for each detected section in the prompt. Each section hash is the hash of the section's normalized content (after whitespace and formatting normalization, but before section reordering). Per-section hashes enable partial matching: two prompts that share 4 out of 5 sections can be identified as near-duplicates by comparing their per-section hash arrays, even if their full normalized hashes differ.

### Hash Computation

The hash computation process is:

1. Parse the prompt to detect format (plain text, message array, Anthropic format).
2. Extract text content from the parsed prompt (concatenating role contents for structured formats).
3. Apply the normalization pipeline to produce the canonical form.
4. Compute the normalized hash by hashing the canonical form with the selected algorithm.
5. Compute the structural skeleton by stripping non-structural text.
6. Compute the structural hash by hashing the skeleton.
7. Detect sections and compute per-section hashes by hashing each section's normalized content.
8. Return a `HashResult` containing all three hash types and metadata.

---

## 7. Similarity Scoring

### Overview

Similarity scoring quantifies how similar two prompts are on a continuous scale from 0.0 (completely different) to 1.0 (identical after normalization). The score is computed as a weighted combination of four independent similarity metrics, each capturing a different dimension of textual similarity. The composite approach is more robust than any single metric: Jaccard similarity handles word-level overlap well but misses word order; edit distance respects order but is sensitive to insertions; n-gram shingling captures local phrase patterns; structural similarity detects organizational equivalence.

### 7.1 Token-Level Jaccard Similarity

**What it measures**: The overlap between the word sets of two prompts, ignoring word order and frequency.

**How it works**: Both prompts are tokenized into word sets (splitting on whitespace and punctuation). The Jaccard index is computed as `|A intersection B| / |A union B|`, where A and B are the word sets. A Jaccard index of 1.0 means both prompts use exactly the same set of words; 0.0 means they share no words. This metric was used in the GPT-3 dataset preparation pipeline for approximate deduplication and is the foundation of MinHash-based near-duplicate detection.

**Strengths**: Fast (O(n) with hash sets), order-insensitive, robust to rearrangement.

**Weaknesses**: Ignores word frequency and order. "The cat sat on the mat" and "The mat sat on the cat" have Jaccard similarity of 1.0 despite different meanings.

**Weight in composite score**: 0.30 (default).

### 7.2 N-gram Shingling Similarity

**What it measures**: The overlap between the n-gram (shingle) sets of two prompts, capturing local phrase-level patterns.

**How it works**: Both prompts are decomposed into overlapping n-grams of configurable size (default: 3 words). For example, "You are a helpful assistant" produces the 3-grams {"You are a", "are a helpful", "a helpful assistant"}. The Jaccard index is then computed on these n-gram sets. N-gram shingling is the standard preprocessing step for MinHash-based near-duplicate detection, as used by Broder (1997) for AltaVista and by Google's SimHash for web crawl deduplication.

**Strengths**: Captures local word ordering and phrase structure. More discriminative than word-level Jaccard for prompts that share vocabulary but differ in phrasing.

**Weaknesses**: Sensitive to n-gram size selection. Small n (2) is too permissive; large n (5+) is too strict for short prompts.

**Weight in composite score**: 0.30 (default).

**Configurable**: n-gram size (default: 3).

### 7.3 Normalized Edit Distance

**What it measures**: The character-level distance between two prompts, normalized to a 0-1 similarity scale.

**How it works**: Computes the Levenshtein edit distance (minimum number of single-character insertions, deletions, and substitutions to transform one string into the other) between the two normalized prompts. The similarity is `1 - (distance / max(len(A), len(B)))`. A similarity of 1.0 means the strings are identical; 0.0 means they share no characters in common positions.

**Strengths**: Respects character ordering, sensitive to small differences, well-understood metric.

**Weaknesses**: Computationally expensive for long strings (O(n*m) time and space). For prompts exceeding 10,000 characters, the computation is skipped and a fallback estimate based on prefix/suffix matching is used to keep latency under 2ms.

**Weight in composite score**: 0.20 (default).

### 7.4 Structural Similarity

**What it measures**: Whether two prompts have the same organizational structure -- same roles, same sections, same number of examples, same variable positions.

**How it works**: Both prompts are parsed into lightweight structural representations: a list of detected roles, section titles, template variable positions, and example block boundaries. The structural similarity is computed as the average of: (a) role match score (1.0 if same roles in same order, 0.0 otherwise), (b) section title overlap (Jaccard on section title sets), (c) variable count similarity (1 - |countA - countB| / max(countA, countB)), and (d) example count similarity (same formula). This metric captures whether two prompts are "the same kind of prompt" structurally, even if the specific text differs significantly.

**Strengths**: Detects structural equivalence that text-level metrics miss. Two prompts with completely different words but the same Instructions/Examples/Output Format structure score high on structural similarity.

**Weaknesses**: Insensitive to text content. Two structurally identical prompts with completely different instructions score 1.0 on structure alone.

**Weight in composite score**: 0.20 (default).

### 7.5 Composite Score

The composite similarity score is the weighted sum of the four individual metrics:

```
composite = (w_jaccard * jaccard) + (w_shingle * shingle) + (w_edit * editSimilarity) + (w_structure * structural)
```

Default weights: `{ jaccard: 0.30, shingle: 0.30, edit: 0.20, structure: 0.20 }`. Weights are configurable and must sum to 1.0.

The composite score is returned alongside the individual metric scores, enabling consumers to inspect which dimensions contributed to the overall similarity.

### 7.6 Duplicate Threshold

The duplicate threshold is the minimum composite similarity score required to classify two prompts as near-duplicates. The default threshold is 0.85. Setting the threshold higher (e.g., 0.95) reduces false positives but may miss near-duplicates with moderate textual differences. Setting it lower (e.g., 0.70) catches more near-duplicates but increases false positives.

Recommended thresholds by use case:

| Use Case | Recommended Threshold |
|---|---|
| Cache key dedup (conservative) | 0.95 |
| Prompt registry dedup | 0.85 |
| Prompt analytics grouping | 0.70 |
| Broad similarity detection | 0.60 |

---

## 8. API Surface

### Installation

```bash
npm install prompt-dedup
```

### No Runtime Dependencies

`prompt-dedup` has zero runtime dependencies. All functionality is implemented using Node.js built-in modules (`node:crypto` for hashing, `node:fs/promises` for file reading, `node:util` for CLI argument parsing, `node:process` for exit codes and stdin).

### Main Export: `normalize`

Normalizes a prompt through the configurable pipeline and returns the canonical form.

```typescript
import { normalize } from 'prompt-dedup';

const canonical = normalize(
  'You are a helpful assistant.\n\n\n   Answer questions clearly.   \n',
);
// "You are a helpful assistant.\n\nAnswer questions clearly."

const canonical2 = normalize(
  'Hello {{user_name}}, your order {{order_id}} is ready.',
);
// "Hello {{VAR_0}}, your order {{VAR_1}} is ready."
```

**Signature:**

```typescript
function normalize(
  prompt: PromptInput,
  options?: NormalizeOptions,
): string;
```

### Main Export: `hash`

Normalizes a prompt and computes content hashes.

```typescript
import { hash } from 'prompt-dedup';

const result = hash('You are a helpful assistant. Answer questions.');

console.log(result.normalized);
// "a1b2c3d4e5f6..." (64-char SHA-256 hex)

console.log(result.structural);
// "f7e8d9c0b1a2..." (hash of structural skeleton)

console.log(result.sections);
// ["abc123...", "def456..."] (per-section hashes)
```

**Signature:**

```typescript
function hash(
  prompt: PromptInput,
  options?: HashOptions,
): HashResult;
```

### Main Export: `similarity`

Computes a composite similarity score between two prompts.

```typescript
import { similarity } from 'prompt-dedup';

const result = similarity(
  'You are a helpful assistant. Answer questions clearly.',
  'You are a helpful assistant. Answer questions concisely.',
);

console.log(result.score);       // 0.89
console.log(result.jaccard);     // 0.85
console.log(result.shingle);     // 0.82
console.log(result.editDistance); // 0.93
console.log(result.structural);  // 1.0
console.log(result.isDuplicate); // true (above default 0.85 threshold)
```

**Signature:**

```typescript
function similarity(
  promptA: PromptInput,
  promptB: PromptInput,
  options?: SimilarityOptions,
): SimilarityResult;
```

### Main Export: `isDuplicate`

Convenience function that returns a boolean duplicate verdict.

```typescript
import { isDuplicate } from 'prompt-dedup';

const dup = isDuplicate(
  'You are a helpful assistant.',
  'You are a helpful   assistant.',
);
// true (identical after whitespace normalization)

const notDup = isDuplicate(
  'You are a code reviewer.',
  'You are a translator.',
);
// false (different prompts)

const customThreshold = isDuplicate(promptA, promptB, { threshold: 0.95 });
```

**Signature:**

```typescript
function isDuplicate(
  promptA: PromptInput,
  promptB: PromptInput,
  options?: DuplicateOptions,
): boolean;
```

### Main Export: `createIndex`

Creates a `DedupIndex` for efficient batch deduplication.

```typescript
import { createIndex } from 'prompt-dedup';

const index = createIndex({ threshold: 0.85 });

const r1 = index.add('You are a helpful assistant. Answer questions.');
// { hash: "a1b2...", isDuplicate: false, groupId: "g1" }

const r2 = index.add('You are a helpful assistant.  Answer questions.');
// { hash: "a1b2...", isDuplicate: true, duplicateOf: "a1b2...", groupId: "g1", similarity: 1.0 }

const r3 = index.add('You are a code reviewer. Review code for bugs.');
// { hash: "c3d4...", isDuplicate: false, groupId: "g2" }

const match = index.find('You are a helpful assistant. Answer questions clearly.');
// { hash: "a1b2...", similarity: 0.91, groupId: "g1" }

const groups = index.groups();
// [
//   { groupId: "g1", canonical: "a1b2...", members: ["a1b2...", "a1b2..."], count: 2 },
//   { groupId: "g2", canonical: "c3d4...", members: ["c3d4..."], count: 1 },
// ]

const stats = index.stats();
// { totalAdded: 3, uniqueGroups: 2, duplicatesFound: 1, deduplicationRate: 0.333 }
```

**Signature:**

```typescript
function createIndex(options?: IndexOptions): DedupIndex;
```

### Type Definitions

```typescript
// ── Prompt Input ─────────────────────────────────────────────────────

/**
 * A prompt in any supported format.
 */
type PromptInput =
  | string                        // Plain text prompt
  | PromptMessage[]               // OpenAI-style message array
  | AnthropicPrompt               // Anthropic-style prompt object
  | { file: string };             // Read from file path

/** A single message in a message array. */
interface PromptMessage {
  role: 'system' | 'user' | 'assistant' | 'developer';
  content: string;
}

/** Anthropic-style prompt with separate system field. */
interface AnthropicPrompt {
  system: string;
  messages: Array<{ role: 'user' | 'assistant'; content: string }>;
}

// ── Normalize Options ────────────────────────────────────────────────

/** Configuration for the normalization pipeline. */
interface NormalizeOptions {
  /**
   * Enable or disable individual normalization steps.
   * Keys are step IDs. Values are booleans.
   */
  steps?: {
    whitespace?: boolean;     // Default: true
    case?: boolean;           // Default: false
    variables?: boolean;      // Default: true
    'section-order'?: boolean; // Default: false
    'example-order'?: boolean; // Default: false
    formatting?: boolean;     // Default: true
  };

  /**
   * Template syntax to use for variable extraction.
   * Default: 'auto' (detect from content).
   */
  templateSyntax?: 'auto' | 'handlebars' | 'jinja2' | 'fstring' | 'dollar';
}

// ── Hash Options ─────────────────────────────────────────────────────

/** Configuration for hash computation. */
interface HashOptions extends NormalizeOptions {
  /**
   * Hash algorithm to use.
   * - 'sha256': SHA-256 (64-char hex). Collision-resistant. Default.
   * - 'xxhash64': xxHash64 (16-char hex). Fastest.
   */
  algorithm?: 'sha256' | 'xxhash64';
}

/** Result of a hash() call. */
interface HashResult {
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

// ── Similarity Options ───────────────────────────────────────────────

/** Configuration for similarity scoring. */
interface SimilarityOptions extends NormalizeOptions {
  /**
   * Weights for the composite similarity score.
   * Must sum to 1.0. Default: { jaccard: 0.30, shingle: 0.30, edit: 0.20, structure: 0.20 }.
   */
  weights?: {
    jaccard?: number;
    shingle?: number;
    edit?: number;
    structure?: number;
  };

  /**
   * N-gram size for shingling similarity.
   * Default: 3.
   */
  shingleSize?: number;

  /**
   * Similarity threshold for duplicate classification.
   * Default: 0.85.
   */
  threshold?: number;

  /**
   * Maximum prompt length (in characters) for edit distance computation.
   * Prompts exceeding this length skip edit distance and use a
   * faster prefix/suffix estimate. Default: 10000.
   */
  maxEditDistanceLength?: number;
}

/** Result of a similarity() call. */
interface SimilarityResult {
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

  /** Wall-clock time for the similarity computation, in milliseconds. */
  durationMs: number;
}

// ── Duplicate Options ────────────────────────────────────────────────

/** Configuration for isDuplicate(). */
interface DuplicateOptions extends SimilarityOptions {
  /**
   * Similarity threshold for duplicate classification.
   * Default: 0.85.
   */
  threshold?: number;
}

// ── Index Types ──────────────────────────────────────────────────────

/** Configuration for createIndex(). */
interface IndexOptions extends HashOptions {
  /**
   * Similarity threshold for grouping duplicates.
   * Default: 0.85.
   */
  threshold?: number;

  /**
   * Maximum number of prompts the index can hold.
   * When exceeded, oldest entries are evicted.
   * Default: 100000.
   */
  maxSize?: number;

  /**
   * Whether to compute and store similarity scores on add().
   * When false, only exact hash matching is used (faster).
   * When true, near-duplicate detection via similarity scoring is enabled.
   * Default: true.
   */
  nearDuplicateDetection?: boolean;
}

/** Result of index.add(). */
interface AddResult {
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
interface FindResult {
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
interface DedupGroup {
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
interface DedupStats {
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

/** The in-memory dedup index. */
interface DedupIndex {
  /**
   * Add a prompt to the index. Returns whether it is a duplicate.
   */
  add(prompt: PromptInput, metadata?: Record<string, unknown>): AddResult;

  /**
   * Find the nearest match for a prompt without adding it.
   * Returns null if no match exceeds the similarity threshold.
   */
  find(prompt: PromptInput): FindResult | null;

  /**
   * Returns all dedup groups.
   */
  groups(): DedupGroup[];

  /**
   * Returns dedup groups with more than one member (actual duplicates).
   */
  duplicateGroups(): DedupGroup[];

  /**
   * Returns dedup statistics.
   */
  stats(): DedupStats;

  /**
   * Returns the number of entries in the index.
   */
  size(): number;

  /**
   * Removes all entries from the index.
   */
  clear(): void;

  /**
   * Serializes the index to a JSON-compatible object for persistence.
   */
  serialize(): SerializedIndex;

  /**
   * Restores the index from a serialized object.
   */
  static deserialize(data: SerializedIndex, options?: IndexOptions): DedupIndex;
}

/** Serialized form of the index for persistence. */
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

### Example: Normalize and Hash for Cache Key

```typescript
import { hash } from 'prompt-dedup';

function getCacheKey(prompt: string): string {
  return hash(prompt).normalized;
}

// These all produce the same cache key:
getCacheKey('You are a helpful assistant.\n\nAnswer questions.');
getCacheKey('You are a helpful assistant.\n\n\n   Answer questions.   ');
getCacheKey('You are a helpful assistant.\r\nAnswer questions.');
```

### Example: Dedup a Prompt Collection

```typescript
import { createIndex } from 'prompt-dedup';

const index = createIndex({ threshold: 0.85 });

const prompts = [
  'You are a helpful assistant. Answer questions about our products.',
  'You are a helpful assistant.  Answer questions about our products.',
  'You are a code reviewer. Review code for bugs and security issues.',
  'You are a helpful assistant. Answer questions about our product catalog.',
  'You are a code reviewer. Check code for bugs and security vulnerabilities.',
];

for (const prompt of prompts) {
  const result = index.add(prompt);
  if (result.isDuplicate) {
    console.log(`Duplicate detected (similarity: ${result.similarity})`);
  }
}

console.log(index.stats());
// { totalAdded: 5, uniqueGroups: 2, duplicatesFound: 3, deduplicationRate: 0.6 }

for (const group of index.duplicateGroups()) {
  console.log(`Group ${group.groupId}: ${group.count} members`);
}
```

### Example: Compare Two Message Array Prompts

```typescript
import { similarity } from 'prompt-dedup';

const result = similarity(
  [
    { role: 'system', content: 'You are a code reviewer.' },
    { role: 'user', content: '{{code}}' },
  ],
  [
    { role: 'system', content: 'You are a code reviewer.' },
    { role: 'user', content: '{{source_code}}' },
  ],
);

console.log(result.score);       // 1.0 (variables normalized to same placeholders)
console.log(result.isDuplicate); // true
```

---

## 9. Dedup Index

### Overview

The `DedupIndex` is an in-memory data structure for efficient batch deduplication. It stores normalized prompt hashes and canonical forms, enabling O(1) exact duplicate detection and O(n) near-duplicate detection (where n is the number of entries). The index supports incremental addition, nearest-neighbor querying, group retrieval, and serialization for persistence.

### Data Structure

The index uses two internal data structures:

**Hash Map (exact duplicates)**: A `Map<string, IndexEntry>` keyed by normalized hash. When a new prompt is added, its normalized hash is computed and looked up in the map. If found, the prompt is an exact duplicate (after normalization) and is immediately classified as a duplicate. This lookup is O(1).

**Canonical Form Array (near-duplicates)**: An array of `{ hash, canonicalForm, groupId }` objects for all unique entries. When a new prompt's hash is not found in the hash map (not an exact duplicate), the index computes the similarity between the new prompt's canonical form and each existing canonical form. If any similarity exceeds the threshold, the new prompt is classified as a near-duplicate and assigned to the matching group. This scan is O(n) where n is the number of unique entries.

For most use cases with up to 10,000 unique prompts, the linear scan completes in under 5ms. For larger collections, the index supports an optional optimization: when `nearDuplicateDetection` is set to `false`, only exact hash matching is used, providing O(1) lookups at the cost of missing near-duplicates that do not normalize to exactly the same string.

### Memory Management

Each index entry stores the normalized hash (64 bytes for SHA-256, 16 bytes for xxHash64), the canonical form (variable-length string, typically 1-10 KB), the group ID (36 bytes UUID), and optional metadata. For 10,000 entries averaging 5 KB of canonical form text, the total memory footprint is approximately 50 MB. The `maxSize` option (default: 100,000) caps the number of entries; when exceeded, the oldest entries are evicted using a FIFO strategy.

### Serialization and Persistence

The `serialize()` method returns a JSON-compatible object containing all entries, groups, and configuration. This object can be written to disk (`JSON.stringify` + `fs.writeFile`) and restored later with `DedupIndex.deserialize()`. Serialization enables persistent deduplication across process restarts -- for example, a CI pipeline can serialize the index after each run and deserialize it at the start of the next run.

The serialized format includes a version number for forward compatibility. Version 1 is the initial format. Future versions may add fields but will remain backward-compatible with version 1 deserialization.

### Group Management

Groups are managed automatically:

1. When a prompt is added and no existing entry matches (no exact hash match, no near-duplicate above threshold), a new group is created with a generated UUID. The new prompt is the canonical member.
2. When a prompt matches an existing entry (exact hash or near-duplicate), it is added to the matching entry's group. The original canonical member remains the canonical representative.
3. Groups are immutable once created: members are added but never removed (entries can be evicted from the index for memory management, but group membership records persist until `clear()` is called).

---

## 10. CLI Interface

### Installation and Invocation

```bash
# Global install
npm install -g prompt-dedup
prompt-dedup ./prompts/

# npx (no install)
npx prompt-dedup ./prompts/

# Package script
# package.json: { "scripts": { "dedup:check": "prompt-dedup ./prompts/" } }
npm run dedup:check
```

### CLI Binary Name

`prompt-dedup`

### Commands and Flags

```
prompt-dedup [files/globs...] [options]

Positional arguments:
  files/globs              One or more file paths or glob patterns to analyze.
                           Examples: ./system-prompt.md, ./prompts/**/*.md
                           If no files specified, reads from stdin.

Mode options:
  --analyze                Analyze prompt files for duplicates and report
                           groups, stats, and potential cache-hit improvement.
                           Default mode.
  --check                  Exit with code 1 if any duplicates are found above
                           the threshold. For CI/CD gating.
  --hash                   Print the normalized hash of each input prompt.
                           One hash per line.
  --compare <file>         Compare stdin or the first positional file against
                           the specified file. Print similarity score.

Normalization options:
  --step <id:enabled>      Enable or disable a normalization step (repeatable).
                           Example: --step case:true --step section-order:true
  --template-syntax <syn>  Template syntax. Values: auto, handlebars, jinja2,
                           fstring, dollar. Default: auto.

Similarity options:
  --threshold <number>     Similarity threshold for duplicate classification
                           (0.0 to 1.0). Default: 0.85.
  --shingle-size <n>       N-gram size for shingling. Default: 3.

Hash options:
  --algorithm <alg>        Hash algorithm. Values: sha256, xxhash64.
                           Default: sha256.

Output options:
  --format <format>        Output format. Values: human, json.
                           Default: human.
  --quiet                  Suppress all output except essential results.
  --no-color               Disable colored output.

General:
  --version                Print version and exit.
  --help                   Print help and exit.
```

### Exit Codes

| Code | Meaning |
|------|---------|
| `0` | Success. Analysis completed (or no duplicates found in `--check` mode). |
| `1` | Duplicates found (in `--check` mode). |
| `2` | Configuration error. Invalid flags, no input files, file read failure. |

### Human-Readable Output Example

```
$ prompt-dedup ./prompts/**/*.md

  prompt-dedup v0.1.0

  Scanned: 15 prompt files
  Algorithm: sha256
  Threshold: 0.85

  ── Dedup Summary ──────────────────────────────────────────────

  Total prompts:       15
  Unique prompts:       8
  Duplicate groups:     4
  Duplicates found:     7
  Dedup rate:         46.7%

  ── Duplicate Groups ───────────────────────────────────────────

  Group 1 (3 members):
    [canonical] prompts/support-v1.md          (hash: a1b2c3d4)
                prompts/support-v2.md          (similarity: 0.97)
                prompts/customer-help.md       (similarity: 0.91)

  Group 2 (2 members):
    [canonical] prompts/code-review.md         (hash: e5f6a7b8)
                prompts/review-code.md         (similarity: 0.93)

  Group 3 (2 members):
    [canonical] prompts/translator.md          (hash: c9d0e1f2)
                prompts/translate-text.md      (similarity: 0.88)

  Group 4 (2 members):
    [canonical] prompts/summarizer-v1.md       (hash: 3a4b5c6d)
                prompts/summarizer-v3.md       (similarity: 0.86)

  ─────────────────────────────────────────────────────────────
  7 duplicates found across 4 groups (46.7% dedup rate)
  Analyzed in 12ms
```

### JSON Output Example

```bash
$ prompt-dedup ./prompts/**/*.md --format json
```

Outputs the full analysis result as a JSON object containing `stats`, `groups`, and per-file `entries`.

### Hash Mode

```bash
$ prompt-dedup --hash ./prompts/system-prompt.md
a1b2c3d4e5f6a7b8c9d0e1f23a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b

$ echo "You are a helpful assistant." | prompt-dedup --hash --stdin
a1b2c3d4e5f6a7b8c9d0e1f23a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b
```

### Compare Mode

```bash
$ prompt-dedup --compare ./prompts/v2.md ./prompts/v1.md

  Similarity: 0.91 (duplicate, threshold: 0.85)
  Jaccard: 0.88  Shingle: 0.85  Edit: 0.94  Structure: 1.00
```

### Environment Variables

| Environment Variable | Equivalent Flag |
|---------------------|-----------------|
| `PROMPT_DEDUP_THRESHOLD` | `--threshold` |
| `PROMPT_DEDUP_ALGORITHM` | `--algorithm` |
| `PROMPT_DEDUP_FORMAT` | `--format` |
| `NO_COLOR` | `--no-color` |

---

## 11. Configuration

### Configuration File

`prompt-dedup` searches for a configuration file in the current directory and ancestor directories, using the first one found:

1. `.prompt-dedup.json`
2. `.prompt-deduprc` (JSON format)
3. `prompt-dedup` key in `package.json`

The `--config` flag overrides auto-detection.

### Configuration File Format

```json
{
  "threshold": 0.85,
  "algorithm": "sha256",
  "shingleSize": 3,
  "templateSyntax": "auto",
  "steps": {
    "whitespace": true,
    "case": false,
    "variables": true,
    "section-order": false,
    "example-order": false,
    "formatting": true
  },
  "weights": {
    "jaccard": 0.30,
    "shingle": 0.30,
    "edit": 0.20,
    "structure": 0.20
  },
  "index": {
    "maxSize": 100000,
    "nearDuplicateDetection": true
  }
}
```

### Configuration Precedence

Configuration is resolved in this order (later sources override earlier):

1. Built-in defaults.
2. Configuration file (`.prompt-dedup.json` or equivalent).
3. Environment variables.
4. CLI flags.
5. Programmatic options in API calls.

---

## 12. Integration

### LLM Response Cache Integration

The primary integration pattern for `prompt-dedup` is as a cache key normalizer for LLM response caches. By normalizing prompts before computing cache keys, applications achieve higher cache hit rates.

```typescript
import { hash } from 'prompt-dedup';
import { createClient } from 'redis';

const redis = createClient();

async function callLLM(prompt: string): Promise<string> {
  const cacheKey = `llm:${hash(prompt).normalized}`;

  const cached = await redis.get(cacheKey);
  if (cached) return cached;

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [{ role: 'system', content: prompt }],
  });

  const text = response.choices[0].message.content;
  await redis.set(cacheKey, text, { EX: 3600 });
  return text;
}
```

This pattern ensures that `"You are a helpful assistant.\n\nAnswer questions."` and `"You are a helpful assistant.\n\n\n   Answer questions.   "` produce the same cache key and share the same cached response.

### Anthropic Prompt Caching Optimization

Anthropic's prompt caching requires exact prefix matches -- even a single character difference creates a new cache entry. `prompt-dedup`'s normalization can be used to standardize prompts before sending them to the Anthropic API, maximizing cache hit rates:

```typescript
import { normalize } from 'prompt-dedup';

function prepareForAnthropic(systemPrompt: string): string {
  return normalize(systemPrompt, {
    steps: {
      whitespace: true,
      formatting: true,
      variables: false,   // keep variables for Anthropic to process
      case: false,         // preserve original casing
    },
  });
}
```

### OpenAI Prefix Caching Optimization

OpenAI's automatic prefix caching matches on exact token-level prefixes. Normalizing the static portion of prompts ensures consistent prefix tokens:

```typescript
import { normalize } from 'prompt-dedup';

const normalizedSystemPrompt = normalize(systemPrompt);
// Use the normalized prompt consistently across all requests
// to maximize OpenAI's automatic prefix cache hits
```

### Integration with prompt-optimize

Use `prompt-dedup` to identify duplicates before optimizing. Deduplicate first, then optimize each unique prompt once:

```bash
# Step 1: Find duplicates
npx prompt-dedup ./prompts/ --format json > dedup-report.json

# Step 2: Optimize each unique prompt
for file in $(jq -r '.groups[].canonical' dedup-report.json); do
  npx prompt-optimize "$file" --in-place --safety moderate
done
```

### Integration with Logging and Analytics

```typescript
import { hash } from 'prompt-dedup';

function logLLMCall(prompt: string, response: string): void {
  const promptHash = hash(prompt).normalized;

  logger.info({
    promptHash,
    promptLength: prompt.length,
    responseLength: response.length,
    // Group by promptHash to see per-template analytics
  });
}
```

### CI/CD Duplicate Prevention

```yaml
name: Prompt Dedup Check
on: pull_request

jobs:
  dedup-check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npx prompt-dedup ./prompts/**/*.md --check --threshold 0.90
```

---

## 13. Testing Strategy

### Unit Tests

Unit tests verify each component in isolation.

- **Normalization step tests**: For each normalization step (whitespace, case, variables, section-order, example-order, formatting), test with:
  - Input that contains the targeted pattern (expect normalization).
  - Input that does not contain the targeted pattern (expect no changes).
  - Input where the pattern appears inside a protected region (code block) -- expect no changes.
  - Edge cases: empty input, input that is only whitespace, input with mixed patterns.

- **Whitespace normalization tests**: Verify collapsing of multiple spaces, tabs, blank lines, `\r\n` to `\n`, trimming of leading/trailing whitespace, and preservation of code block whitespace.

- **Variable extraction tests**: For each template syntax (handlebars, jinja2, fstring, dollar), verify correct detection and replacement with `{{VAR_N}}` placeholders. Test multiple occurrences of the same variable. Test mixed syntaxes in `auto` mode. Test false positives (JSON braces, code curly braces).

- **Section detection tests**: Verify detection of markdown headers, XML tags, and labeled blocks. Test prompts with no sections, one section, and many sections.

- **Hash tests**: Verify that identical prompts produce identical hashes. Verify that different prompts produce different hashes. Verify that prompts differing only in whitespace produce identical hashes (with whitespace normalization enabled). Test both SHA-256 and xxHash64 algorithms. Verify hash format (hex string, correct length).

- **Similarity tests**: For each similarity metric (Jaccard, shingle, edit distance, structural), test with known inputs and verify expected scores. Test edge cases: identical strings (1.0), completely different strings (close to 0.0), empty strings, single-word strings.

- **Composite score tests**: Verify that the composite score is the weighted sum of individual metrics. Verify that custom weights produce expected results. Verify that weights must sum to 1.0.

- **Index tests**: Verify add, find, groups, duplicateGroups, stats, size, clear, serialize, and deserialize operations. Test exact duplicate detection. Test near-duplicate detection with various similarity scores. Test maxSize eviction. Test that deserialized index produces the same results as the original.

- **CLI argument parsing tests**: Verify parsing of all flags, environment variable fallback, and error messages for invalid input.

### Integration Tests

Integration tests run the full pipeline against realistic prompt collections.

- **Exact duplicate set**: Add 10 prompts that differ only in whitespace to an index. Assert all are assigned to the same group. Assert dedup rate is 90%.
- **Near-duplicate set**: Add 5 prompts that are textually similar (same structure, different phrasing) to an index. Assert they are grouped together. Assert similarity scores are above threshold.
- **Distinct prompt set**: Add 10 completely different prompts. Assert each is in its own group. Assert dedup rate is 0%.
- **Mixed collection**: Add a realistic collection of 50 prompts with some duplicates, some near-duplicates, and some unique prompts. Assert expected group counts and dedup rate.
- **Message array format**: Test normalization and hashing of OpenAI-style message arrays. Assert that two message arrays with identical content but different whitespace produce the same hash.
- **Template variable dedup**: Test that two prompts with the same structure but different variable names produce the same hash after variable extraction.
- **CLI end-to-end**: Run the CLI binary against test fixture directories. Verify exit codes, stdout output format, and JSON output structure.
- **Serialization round-trip**: Create an index, add prompts, serialize, deserialize, and verify that the restored index produces identical results.
- **Idempotency**: Normalize a prompt, then normalize the result again. Assert the second normalization produces no changes.

### Edge Cases to Test

- Empty prompt (empty string, empty file).
- Prompt containing only whitespace.
- Prompt containing only template variables.
- Prompt exceeding 100 KB (performance test).
- Two completely identical prompts (exact match, score 1.0).
- Two completely different prompts (minimal overlap, score near 0.0).
- Prompt with deeply nested code blocks containing template-like syntax.
- Binary file accidentally passed as input.
- File that does not exist (error handling).
- Index with maxSize of 1 (immediate eviction).
- Unicode content (emoji, CJK characters, Arabic).
- Prompt with thousands of template variables.

### Test Framework

Tests use Vitest, matching the project's existing `package.json` configuration. Test fixtures are stored in `src/__tests__/fixtures/` as static prompt files.

---

## 14. Performance

### Normalization

The normalization pipeline is a single sequential pass through the text for each enabled step. Each step uses string operations and regex matching. For a 10,000-character prompt (~2,500 tokens) with all default steps enabled (whitespace, variables, formatting), the full normalization completes in under 0.5ms. For a 100,000-character prompt (~25,000 tokens), normalization completes in under 3ms.

### Hashing

SHA-256 hashing uses Node.js's built-in `node:crypto` module, which delegates to OpenSSL's optimized implementation. For a 10,000-character normalized prompt, hashing completes in under 0.02ms. For a 100,000-character prompt, hashing completes in under 0.1ms. Total normalize-and-hash time for a typical prompt: under 1ms.

xxHash64 uses a pure TypeScript implementation. It is approximately 3-5x faster than SHA-256 for prompt-length inputs, though both are sub-millisecond for typical prompts. The speed advantage is more significant for batch operations (hashing thousands of prompts).

### Similarity Scoring

Jaccard similarity and n-gram shingling use hash set operations, completing in O(n) time where n is the number of tokens/shingles. For two 10,000-character prompts, both metrics complete in under 0.5ms each.

Normalized edit distance uses a standard dynamic programming algorithm with O(n*m) time and space. For two 10,000-character prompts, the computation takes approximately 1-2ms. For prompts exceeding the `maxEditDistanceLength` threshold (default: 10,000 characters), a faster O(n) prefix/suffix estimation is used instead, completing in under 0.1ms.

Structural similarity involves lightweight parsing (role detection, section title extraction, variable counting) and simple set/count comparisons. It completes in under 0.2ms for typical prompts.

Total similarity computation between two typical prompts: under 2ms.

### Index Operations

- **add() with exact match**: O(1) hash map lookup + O(1) normalization and hashing. Under 1ms total.
- **add() with near-duplicate scan**: O(n) similarity comparisons where n is the number of unique entries. For an index with 1,000 unique entries, the scan takes approximately 2-5ms. For 10,000 entries, approximately 20-50ms.
- **find()**: Same complexity as add() but does not modify the index.
- **groups()**: O(1), returns the pre-computed group list.
- **serialize()**: O(n) where n is the number of entries. For 10,000 entries, approximately 5-10ms.

### Memory

Each index entry stores a hash string (64 bytes for SHA-256) and a canonical form string (average 5 KB). For 10,000 entries, total memory is approximately 50 MB. The `maxSize` option prevents unbounded growth.

---

## 15. Dependencies

### Runtime Dependencies

None. `prompt-dedup` has zero runtime dependencies. All functionality is implemented using Node.js built-in modules:

| Node.js Built-in | Purpose |
|---|---|
| `node:crypto` | SHA-256 hash computation via `createHash`. |
| `node:fs/promises` | Reading prompt files from disk. |
| `node:path` | File path resolution, extension detection. |
| `node:util` | `parseArgs` for CLI argument parsing (Node.js 18+). |
| `node:process` | Exit codes, stdin reading, environment variables. |

### Why Zero Dependencies

- **No hash library**: SHA-256 is built into Node.js via `node:crypto`. xxHash64 is implemented as a pure TypeScript function (approximately 80 lines). No need for `xxhash`, `murmurhash-native`, or similar native-binding packages.
- **No string similarity library**: Jaccard similarity, n-gram shingling, and Levenshtein edit distance are implemented from scratch. The implementations are specialized for prompt text and total approximately 200 lines. No need for `string-similarity` (17 KB), `fastest-levenshtein` (8 KB), or `natural` (15 MB).
- **No CLI framework**: `node:util.parseArgs` (available since Node.js 18) handles all flag parsing. No dependency on `commander`, `yargs`, or `meow`.
- **No chalk/colors**: Terminal coloring uses ANSI escape codes directly. Color detection uses `process.stdout.isTTY` and the `NO_COLOR` environment variable.
- **No UUID library**: Group IDs are generated using a simple counter-based scheme (`g1`, `g2`, ...) rather than RFC 4122 UUIDs, avoiding the need for `uuid`.

### Dev Dependencies

| Dependency | Purpose |
|---|---|
| `typescript` | TypeScript compiler. |
| `vitest` | Test runner. |
| `eslint` | Linter for source code. |

---

## 16. File Structure

```
prompt-dedup/
  package.json
  tsconfig.json
  SPEC.md
  README.md
  .prompt-dedup.json                Example config (used for self-testing)
  src/
    index.ts                        Public API exports: normalize, hash,
                                    similarity, isDuplicate, createIndex, types.
    cli.ts                          CLI entry point: argument parsing, file I/O,
                                    formatting, exit codes.
    types.ts                        All TypeScript type definitions.
    normalize/
      index.ts                      Normalization pipeline orchestrator: applies
                                    steps in order, returns canonical form.
      whitespace.ts                 Whitespace normalization step.
      case.ts                       Case normalization step.
      variables.ts                  Variable extraction and placeholder
                                    replacement step.
      section-order.ts              Section ordering normalization step.
      example-order.ts              Example ordering normalization step.
      formatting.ts                 Formatting normalization step (markdown
                                    stripping, list marker normalization).
    hash/
      index.ts                      Hash computation entry point: normalized
                                    hash, structural hash, per-section hashes.
      sha256.ts                     SHA-256 wrapper around node:crypto.
      xxhash64.ts                   Pure TypeScript xxHash64 implementation.
      structural.ts                 Structural skeleton extraction for
                                    structural hashing.
    similarity/
      index.ts                      Composite similarity scorer: orchestrates
                                    individual metrics and computes weighted sum.
      jaccard.ts                    Token-level Jaccard similarity.
      shingle.ts                    N-gram shingling similarity.
      edit-distance.ts              Normalized Levenshtein edit distance.
      structural.ts                 Structural similarity (roles, sections,
                                    variables, examples).
    dedup-index/
      index.ts                      DedupIndex implementation: add, find,
                                    groups, stats, serialize, deserialize.
      group-manager.ts              Group creation and membership management.
      eviction.ts                   FIFO eviction when maxSize is exceeded.
    parser/
      index.ts                      Lightweight prompt parser: format detection,
                                    role detection, section detection.
      format-detector.ts            Detects plain text, message array, or
                                    Anthropic format.
      section-detector.ts           Detects section boundaries (headers, XML
                                    tags, labels).
      variable-detector.ts          Detects template variables across syntaxes.
      example-detector.ts           Detects few-shot example blocks.
    config/
      index.ts                      Config file loading and resolution.
      defaults.ts                   Default configuration values.
    formatters/
      index.ts                      Formatter factory.
      human.ts                      Human-readable terminal output with ANSI.
      json.ts                       JSON output.
    utils/
      text.ts                       Text utilities: tokenization, word splitting,
                                    line splitting.
      protected-regions.ts          Code block and protected region detection.
  src/__tests__/
    normalize/
      whitespace.test.ts
      case.test.ts
      variables.test.ts
      section-order.test.ts
      example-order.test.ts
      formatting.test.ts
      pipeline.test.ts              Integration test for the full pipeline.
    hash/
      sha256.test.ts
      xxhash64.test.ts
      structural.test.ts
    similarity/
      jaccard.test.ts
      shingle.test.ts
      edit-distance.test.ts
      structural.test.ts
      composite.test.ts             Tests for the weighted composite scorer.
    dedup-index/
      index.test.ts                 DedupIndex integration tests.
      serialization.test.ts
      eviction.test.ts
    parser/
      format-detector.test.ts
      section-detector.test.ts
      variable-detector.test.ts
    cli.test.ts                     CLI end-to-end tests.
    fixtures/
      prompts/
        simple-prompt.md
        whitespace-variants/        Directory of prompts differing only in
          variant-1.md              whitespace.
          variant-2.md
          variant-3.md
        near-duplicates/            Directory of near-duplicate prompts.
          support-v1.md
          support-v2.md
          support-v3.md
        distinct-prompts/           Directory of completely different prompts.
          code-review.md
          translator.md
          summarizer.md
        templates/                  Prompts with template variables.
          template-handlebars.md
          template-jinja2.md
          template-fstring.md
        message-arrays/             OpenAI-format prompt fixtures.
          simple-messages.json
          multi-turn.json
        empty.md
        large-prompt.md             Performance test fixture (50KB+).
      configs/
        valid-config.json
        custom-thresholds.json
  bin/
    prompt-dedup.js                 CLI binary entry point.
  dist/                             Compiled output (gitignored).
```

---

## 17. Implementation Roadmap

### Phase 1: Normalization and Hashing (v0.1.0)

Implement the normalization pipeline and content hashing with exact duplicate detection.

**Deliverables:**
- Normalization pipeline with default-enabled steps: whitespace, variables, formatting.
- Protected region detection for code blocks.
- SHA-256 hashing via `node:crypto`.
- `normalize()` function returning the canonical form.
- `hash()` function returning `HashResult` with normalized hash.
- `isDuplicate()` function using exact hash comparison (no similarity scoring yet).
- `createIndex()` with hash-map-based exact duplicate detection.
- CLI with `--hash` and `--analyze` modes.
- Unit tests for each normalization step and hash computation.
- Integration tests with fixture prompt files.

### Phase 2: Similarity Scoring and Near-Duplicate Detection (v0.2.0)

Add similarity scoring and near-duplicate detection to the index.

**Deliverables:**
- Token-level Jaccard similarity implementation.
- N-gram shingling similarity implementation.
- Normalized Levenshtein edit distance implementation.
- Structural similarity implementation (lightweight parser for roles, sections, variables).
- Composite similarity scorer with configurable weights.
- `similarity()` function returning `SimilarityResult`.
- `isDuplicate()` updated to use composite similarity scoring.
- `DedupIndex` updated with near-duplicate detection on `add()`.
- `index.find()` for nearest-neighbor queries.
- `index.groups()` and `index.duplicateGroups()` returning cluster information.
- `--compare` CLI mode for pairwise comparison.
- `--check` CLI mode for CI/CD gating.

### Phase 3: Advanced Features (v0.3.0)

Add remaining normalization steps, xxHash64, serialization, and format support.

**Deliverables:**
- Case normalization step (disabled by default).
- Section ordering normalization step (disabled by default).
- Example ordering normalization step (disabled by default).
- xxHash64 pure TypeScript implementation.
- Structural hash and per-section hash computation.
- `DedupIndex` serialization and deserialization.
- Message array (OpenAI) and Anthropic format parsing.
- Configuration file support (`.prompt-dedup.json`).
- Environment variable configuration.
- `--format json` CLI output.
- `maxSize` eviction for the index.

### Phase 4: Polish and 1.0 (v1.0.0)

Stabilize the API, complete documentation, and prepare for broad adoption.

**Deliverables:**
- API stability guarantee (semver major version).
- Complete README with usage examples, integration patterns, and configuration guide.
- Comprehensive edge case testing.
- Performance benchmarks published in README.
- Published npm package with TypeScript declarations.

---

## 18. Example Use Cases

### 18.1 Cache Key Normalization for a Production Chatbot

A customer support chatbot uses a Redis cache to store LLM responses. Without normalization, cache hit rate is 45% due to whitespace and formatting variations across different code paths. After integrating `prompt-dedup`, cache hit rate increases to 72%.

```typescript
import { hash } from 'prompt-dedup';
import { Redis } from 'ioredis';

const redis = new Redis();

async function getResponse(systemPrompt: string, userMessage: string): Promise<string> {
  const promptKey = hash(systemPrompt).normalized;
  const messageKey = hash(userMessage).normalized;
  const cacheKey = `chat:${promptKey}:${messageKey}`;

  const cached = await redis.get(cacheKey);
  if (cached) return cached;

  const response = await callLLM(systemPrompt, userMessage);
  await redis.setex(cacheKey, 3600, response);
  return response;
}

// These produce the same cache key:
getResponse(
  'You are a support agent.\n\nAnswer product questions.',
  'What is your return policy?',
);
getResponse(
  'You are a support agent.\n\n\n   Answer product questions.   \n',
  'What is your return policy?',
);
```

### 18.2 Prompt Registry Deduplication

A platform team maintains 200+ prompts across 15 applications. They suspect significant overlap. Running `prompt-dedup` reveals that 40% of prompts are near-duplicates.

```bash
$ prompt-dedup ./all-prompts/**/*.md --threshold 0.80

  prompt-dedup v0.1.0

  Scanned: 213 prompt files
  Algorithm: sha256
  Threshold: 0.80

  ── Dedup Summary ──────────────────────────────────────────────

  Total prompts:     213
  Unique prompts:    128
  Duplicate groups:   42
  Duplicates found:   85
  Dedup rate:       39.9%

  ── Top Duplicate Groups ───────────────────────────────────────

  Group 1 (8 members):
    [canonical] apps/support/system-prompt.md
                apps/help-desk/main-prompt.md      (0.96)
                apps/chat/support-prompt.md        (0.93)
                apps/faq/system.md                 (0.91)
                apps/tickets/prompt.md             (0.89)
                apps/email/auto-reply-prompt.md    (0.87)
                apps/slack-bot/system-prompt.md    (0.85)
                apps/widget/chat-prompt.md         (0.82)

  ...

  ─────────────────────────────────────────────────────────────
  85 duplicates found across 42 groups
  Recommendation: Consolidate duplicate groups to reduce maintenance
  Analyzed in 145ms
```

### 18.3 CI/CD Duplicate Prevention

A team adds a CI step that prevents new prompts from being too similar to existing ones, avoiding prompt proliferation.

```yaml
name: Prompt Duplicate Guard
on: pull_request

jobs:
  dedup-guard:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - name: Check for duplicate prompts
        run: |
          npx prompt-dedup ./prompts/**/*.md --check --threshold 0.90
          if [ $? -eq 1 ]; then
            echo "::error::Near-duplicate prompts detected. Consolidate before merging."
            exit 1
          fi
```

### 18.4 Template Variable Normalization

A templating system generates prompts with different variable names across applications. `prompt-dedup` identifies that these are the same template.

```typescript
import { similarity } from 'prompt-dedup';

const templateA = 'Hello {{user_name}}, your order {{order_id}} is ready.';
const templateB = 'Hello {{customer}}, your order {{ref_number}} is ready.';

const result = similarity(templateA, templateB);
console.log(result.score);       // 1.0 (after variable extraction, identical)
console.log(result.isDuplicate); // true
```

### 18.5 Observability Dashboard Grouping

An observability pipeline logs every LLM call with a normalized prompt hash, enabling accurate per-template analytics.

```typescript
import { hash } from 'prompt-dedup';

function onLLMCall(prompt: string, response: string, latencyMs: number): void {
  const { normalized: promptHash, structural: structuralHash } = hash(prompt);

  telemetry.recordEvent('llm_call', {
    promptHash,
    structuralHash,
    promptLength: prompt.length,
    responseLength: response.length,
    latencyMs,
  });
}

// Dashboard query: GROUP BY promptHash to see per-template metrics
// Without normalization: 10,000 "unique" prompts
// With normalization:       47 unique prompt templates
```

### 18.6 Batch Dedup with Serialized Index

A nightly job deduplicates prompts across a growing collection, persisting the index between runs.

```typescript
import { createIndex, DedupIndex } from 'prompt-dedup';
import { readFile, writeFile } from 'node:fs/promises';

async function nightlyDedup(): Promise<void> {
  // Load existing index or create new one
  let index: DedupIndex;
  try {
    const data = JSON.parse(await readFile('./dedup-index.json', 'utf-8'));
    index = DedupIndex.deserialize(data);
  } catch {
    index = createIndex({ threshold: 0.85 });
  }

  // Add new prompts from today's log
  const newPrompts = await loadTodaysPrompts();
  for (const prompt of newPrompts) {
    const result = index.add(prompt.text, { source: prompt.source });
    if (result.isDuplicate) {
      logger.info(`Duplicate: ${prompt.source} matches ${result.duplicateOf}`);
    }
  }

  // Report
  const stats = index.stats();
  logger.info(`Dedup stats: ${stats.uniqueGroups} unique, ${stats.duplicatesFound} duplicates`);

  // Persist for next run
  await writeFile('./dedup-index.json', JSON.stringify(index.serialize()));
}
```
