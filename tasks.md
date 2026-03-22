# prompt-dedup — Task Breakdown

This file tracks all tasks required to implement the `prompt-dedup` package per SPEC.md.

---

## Phase 1: Project Scaffolding & Types

- [x] **Define all TypeScript types in `src/types.ts`** — Create the types file with all interfaces and type aliases: `PromptInput`, `PromptMessage`, `AnthropicPrompt`, `NormalizeOptions`, `HashOptions`, `HashResult`, `SimilarityOptions`, `SimilarityResult`, `DuplicateOptions`, `IndexOptions`, `AddResult`, `FindResult`, `DedupGroup`, `DedupStats`, `DedupIndex`, `SerializedIndex`. Include JSDoc comments for every field. | Status: done

- [x] **Set up dev dependencies** — Install `typescript`, `vitest`, and `eslint` as dev dependencies. Verify `npm run build`, `npm run test`, and `npm run lint` scripts work with the existing `package.json` and `tsconfig.json`. | Status: done

- [ ] **Create directory structure** — Create all directories per the spec file structure: `src/normalize/`, `src/hash/`, `src/similarity/`, `src/dedup-index/`, `src/parser/`, `src/config/`, `src/formatters/`, `src/utils/`, `src/__tests__/` (with subdirectories for normalize, hash, similarity, dedup-index, parser, fixtures), and `bin/`. | Status: not_done

- [ ] **Create `src/config/defaults.ts`** — Implement the default configuration values: default normalization steps (whitespace: true, case: false, variables: true, section-order: false, example-order: false, formatting: true), default algorithm (sha256), default threshold (0.85), default shingleSize (3), default weights (jaccard: 0.30, shingle: 0.30, edit: 0.20, structure: 0.20), default index options (maxSize: 100000, nearDuplicateDetection: true), default templateSyntax (auto). | Status: not_done

- [ ] **Add `bin` field to `package.json`** — Add `"bin": { "prompt-dedup": "./bin/prompt-dedup.js" }` to package.json for CLI entry point. | Status: not_done

---

## Phase 2: Utility Modules

- [x] **Implement `src/utils/text.ts`** — Create text utility functions: `tokenize(text)` splits text into word tokens on whitespace and punctuation; `splitLines(text)` splits text into lines; `wordSplit(text)` splits into words; any other shared text manipulation helpers needed by normalization and similarity modules. | Status: done

- [x] **Implement `src/utils/protected-regions.ts`** — Create functions to detect and mark protected regions in prompt text: fenced code blocks (triple backticks), indented code blocks, and quoted strings. Provide a mechanism for normalization steps to skip these regions during transformation. The function should return region boundaries (start/end indices) so that other steps can test whether a given position is inside a protected region. | Status: done

---

## Phase 3: Parser Module

- [x] **Implement `src/parser/format-detector.ts`** — Create `detectFormat(input: PromptInput)` that determines whether the input is a plain text string, an OpenAI-style message array (`{role, content}[]`), an Anthropic-style prompt object (`{system, messages}`), or a file path (`{file: string}`). Return the detected format type and extracted text content. For file paths, read the file synchronously or provide an async variant. For message arrays and Anthropic format, concatenate role contents into a single string with role markers preserved. | Status: done

- [x] **Implement `src/parser/section-detector.ts`** — Create `detectSections(text)` that identifies logical sections in prompt text. Detect section boundaries from: markdown headers (`# Title`, `## Title`, etc.), XML tags (`<instructions>`, `<examples>`), and labeled blocks (`Instructions:`, `Output Format:` followed by content). Return an array of section objects with title, content, start/end positions. Handle prompts with no sections (return a single section spanning the whole text). | Status: done

- [x] **Implement `src/parser/variable-detector.ts`** — Create `detectVariables(text, syntax)` that finds template variables in multiple syntaxes: Handlebars/Mustache (`{{variable}}`), Jinja2 (`{{ variable }}`), f-string (`{variable}`), dollar (`$variable`, `${variable}`). In `auto` mode, detect which syntax is present and use that. Return an array of detected variables with their positions, names, and syntax type. Exclude false positives: JSON braces, code block content, object literals (detected by adjacency to colons/commas). | Status: done

- [ ] **Implement `src/parser/example-detector.ts`** — Create `detectExamples(text)` that identifies few-shot example blocks within prompt text. Detect examples by numbered patterns (`Example 1:`, `1.`, `(1)`) and input/output pair markers (`Input:`, `Output:`). Return an array of example objects with content and boundaries. | Status: not_done

- [x] **Implement `src/parser/index.ts`** — Create the parser orchestrator that combines format detection, section detection, variable detection, and example detection. Export a `parsePrompt(input: PromptInput)` function that returns a structured representation of the prompt including: raw text, detected format, sections, variables, and examples. | Status: done

---

## Phase 4: Normalization Pipeline

- [x] **Implement `src/normalize/whitespace.ts`** — Implement the whitespace normalization step (step ID: `whitespace`). Replace all sequences of whitespace characters (spaces, tabs, `\r\n`, `\r`, `\n`) with a single space within each line. Trim leading and trailing whitespace from each line. Collapse multiple consecutive blank lines into a single blank line. Remove leading and trailing blank lines from the entire prompt. Normalize line endings to `\n`. Preserve whitespace inside fenced code blocks (protected regions). | Status: done

- [x] **Implement `src/normalize/case.ts`** — Implement the case normalization step (step ID: `case`). Convert all non-protected text to lowercase. Protected text includes: content inside code blocks, template variable names, quoted strings, identifiers (camelCase, PascalCase, SCREAMING_SNAKE_CASE, kebab-case). Disabled by default. | Status: done

- [x] **Implement `src/normalize/variables.ts`** — Implement the variable extraction and placeholder replacement step (step ID: `variables`). Detect template variables using the configured syntax (auto, handlebars, jinja2, fstring, dollar). Replace each unique variable with a canonical numbered placeholder (`{{VAR_0}}`, `{{VAR_1}}`, ...) based on order of first appearance. All occurrences of the same variable get the same placeholder. Skip variables inside code blocks. Skip false positives from JSON/object literals. | Status: done

- [x] **Implement `src/normalize/section-order.ts`** — Implement the section ordering normalization step (step ID: `section-order`). Detect logical sections (markdown headers, XML tags, labeled blocks) and sort them alphabetically by title/label. Preserve content within each section. Leave untitled sections in original relative order. Never reorder across role boundaries (system/user/assistant). Disabled by default. | Status: done

- [x] **Implement `src/normalize/example-order.ts`** — Implement the example ordering normalization step (step ID: `example-order`). Detect few-shot examples within example sections. Sort them by a canonical key derived from their content hash (SHA-256 of normalized example text). Preserve content of individual examples. Disabled by default. | Status: done

- [x] **Implement `src/normalize/formatting.ts`** — Implement the formatting normalization step (step ID: `formatting`). Strip markdown formatting markers: bold (`**text**` -> `text`), italic (`*text*`/`_text_` -> `text`), strikethrough (`~~text~~` -> `text`), inline code backticks around non-code content. Normalize list markers (`*`, `-`, `+` all become `-`). Normalize numbered list markers (`1)`, `1.`, `(1)` all become `1.`). Remove horizontal rules (`---`, `***`, `___`). Never touch code blocks, heading levels, or formatting within quoted strings. | Status: done

- [x] **Implement `src/normalize/index.ts`** — Create the normalization pipeline orchestrator. Apply steps in fixed order: whitespace (1), case (2), variables (3), section-order (4), example-order (5), formatting (6). Skip disabled steps. Each step receives the output of the previous step. Return the canonical form string. Accept `NormalizeOptions` to enable/disable steps and configure template syntax. Track which steps were applied for metadata. | Status: done

---

## Phase 5: Hashing

- [x] **Implement `src/hash/sha256.ts`** — Create a SHA-256 hash wrapper using `node:crypto`'s `createHash`. Accept a string input, return a 64-character hex string. No external dependencies. | Status: done

- [ ] **Implement `src/hash/xxhash64.ts`** — Implement xxHash64 as a pure TypeScript function (~80 lines per spec). Accept a string input, return a 16-character hex string. No native dependencies. Must be approximately 3-5x faster than SHA-256 for prompt-length inputs. | Status: not_done

- [x] **Implement `src/hash/structural.ts`** — Create the structural skeleton extractor. Replace all non-structural text with empty strings, preserving only: role markers (system/user/assistant), section headers, template variable placeholders (`{{VAR_N}}`), and structural delimiters. The skeleton represents the prompt's organizational structure without its instructional content. | Status: done

- [x] **Implement `src/hash/index.ts`** — Create the hash computation entry point. Implement the `hash(prompt, options?)` function per spec: (1) parse the prompt to detect format, (2) extract text content, (3) apply normalization pipeline to produce canonical form, (4) compute normalized hash with selected algorithm, (5) compute structural skeleton, (6) compute structural hash, (7) detect sections and compute per-section hashes, (8) return `HashResult` with all three hash types, canonical form, algorithm used, steps applied, and duration in milliseconds. | Status: done

---

## Phase 6: Similarity Scoring

- [x] **Implement `src/similarity/jaccard.ts`** — Implement token-level Jaccard similarity. Tokenize both prompts into word sets (split on whitespace and punctuation). Compute `|A intersection B| / |A union B|`. Return a number between 0.0 and 1.0. Use hash sets for O(n) performance. Handle edge cases: empty sets (return 0.0 if both empty per convention, or 1.0 if both empty — clarify per spec usage). | Status: done

- [x] **Implement `src/similarity/shingle.ts`** — Implement n-gram shingling similarity. Decompose both prompts into overlapping n-grams of configurable size (default: 3 words). Compute Jaccard index on the n-gram sets. Return a number between 0.0 and 1.0. Handle edge cases: prompts shorter than n-gram size. | Status: done

- [x] **Implement `src/similarity/edit-distance.ts`** — Implement normalized Levenshtein edit distance. Compute edit distance between two normalized prompts using standard dynamic programming (O(n*m) time and space). Compute similarity as `1 - (distance / max(len(A), len(B)))`. For prompts exceeding `maxEditDistanceLength` (default: 10000 characters), skip full computation and use a faster prefix/suffix matching estimate to keep latency under 2ms. Handle edge cases: empty strings, identical strings. | Status: done

- [x] **Implement `src/similarity/structural.ts`** — Implement structural similarity. Parse both prompts into structural representations: roles, section titles, variable positions, example block boundaries. Compute the average of: (a) role match score (1.0 if same roles in same order, 0.0 otherwise), (b) section title overlap (Jaccard on section title sets), (c) variable count similarity (`1 - |countA - countB| / max(countA, countB)`), (d) example count similarity (same formula). Return 0.0 to 1.0. | Status: done

- [x] **Implement `src/similarity/index.ts`** — Create the composite similarity scorer. Orchestrate all four metrics (jaccard, shingle, edit distance, structural). Compute weighted sum using configurable weights (must sum to 1.0; validate this). Return `SimilarityResult` with composite score, individual metric scores, isDuplicate boolean (based on threshold comparison), threshold used, and durationMs. Accept `SimilarityOptions` for weights, shingle size, threshold, and maxEditDistanceLength. | Status: done

---

## Phase 7: Dedup Index

- [x] **Implement `src/dedup-index/group-manager.ts`** — Create the group management module. Generate group IDs using a simple counter scheme (`g1`, `g2`, ...). Create new groups when no match is found. Add members to existing groups when duplicates are detected. Track canonical member (first added) per group. Return `DedupGroup` objects. | Status: done

- [x] **Implement `src/dedup-index/eviction.ts`** — Create the FIFO eviction module. When the index exceeds `maxSize`, evict the oldest entries. Track insertion order for eviction. Evict entries from the hash map and canonical form array. Note: group membership records persist until `clear()` per spec. | Status: done

- [x] **Implement `src/dedup-index/index.ts`** — Implement the full `DedupIndex` class. Internal data structures: `Map<string, IndexEntry>` for exact hash lookups (O(1)), and a canonical form array for near-duplicate scanning (O(n)). Implement all methods: `add(prompt, metadata?)` — normalize, hash, check exact match, then scan for near-duplicates if `nearDuplicateDetection` is true, assign to group, return `AddResult`; `find(prompt)` — query without adding, return `FindResult | null`; `groups()` — return all groups; `duplicateGroups()` — return groups with count > 1; `stats()` — return `DedupStats` with totalAdded, uniqueGroups, duplicatesFound, deduplicationRate, memoryUsageBytes; `size()` — return entry count; `clear()` — reset all state; `serialize()` — return `SerializedIndex` JSON-compatible object; static `deserialize(data, options?)` — restore index from serialized data. | Status: done

---

## Phase 8: Public API Exports

- [x] **Implement `src/index.ts` — Public API entry point** — Wire up and export all public functions: `normalize(prompt, options?)`, `hash(prompt, options?)`, `similarity(promptA, promptB, options?)`, `isDuplicate(promptA, promptB, options?)`, `createIndex(options?)`. Also re-export all public types from `types.ts`. The `isDuplicate` function should delegate to `similarity()` and compare the composite score against the threshold. The `createIndex` factory should instantiate and return a `DedupIndex`. | Status: done

---

## Phase 9: Configuration

- [ ] **Implement `src/config/index.ts`** — Create config file loading and resolution. Search for config files in current directory and ancestor directories in order: `.prompt-dedup.json`, `.prompt-deduprc` (JSON format), `prompt-dedup` key in `package.json`. Support `--config` flag to override auto-detection. Merge config with defaults using the precedence order: built-in defaults < config file < environment variables < CLI flags < programmatic API options. | Status: not_done

- [ ] **Implement environment variable support** — Read environment variables: `PROMPT_DEDUP_THRESHOLD` (maps to `--threshold`), `PROMPT_DEDUP_ALGORITHM` (maps to `--algorithm`), `PROMPT_DEDUP_FORMAT` (maps to `--format`), `NO_COLOR` (maps to `--no-color`). Parse and validate values. Apply in the configuration precedence chain. | Status: not_done

---

## Phase 10: CLI

- [ ] **Implement `src/formatters/human.ts`** — Create the human-readable terminal output formatter. Format the dedup analysis report with: version header, scan summary (file count, algorithm, threshold), dedup summary table (total, unique, duplicate groups, duplicates found, dedup rate), duplicate groups section showing canonical member and other members with similarity scores, footer with totals and analysis duration. Use ANSI escape codes for coloring (box-drawing characters, bold, dim). Respect `NO_COLOR` environment variable and `--no-color` flag. | Status: not_done

- [ ] **Implement `src/formatters/json.ts`** — Create the JSON output formatter. Output the full analysis result as a JSON object containing `stats`, `groups`, and per-file `entries`. Use `JSON.stringify` with indentation for readability. | Status: not_done

- [ ] **Implement `src/formatters/index.ts`** — Create the formatter factory that selects human or json formatter based on the `--format` flag. | Status: not_done

- [ ] **Implement `src/cli.ts`** — Create the CLI entry point. Use `node:util.parseArgs` for argument parsing (no external CLI framework). Implement all modes: `--analyze` (default mode — scan files, build index, report groups and stats), `--check` (exit code 1 if duplicates found, for CI/CD), `--hash` (print normalized hash of each input, one per line), `--compare <file>` (compare two files, print similarity score). Implement all flags: `--step <id:enabled>` (repeatable, enable/disable normalization steps), `--template-syntax <syn>`, `--threshold <number>`, `--shingle-size <n>`, `--algorithm <alg>`, `--format <format>`, `--quiet`, `--no-color`, `--version`, `--help`, `--config <path>`. Read from stdin when no positional files specified. Support glob patterns for file arguments. Handle exit codes: 0 (success), 1 (duplicates found in check mode), 2 (configuration/input error). | Status: not_done

- [ ] **Create `bin/prompt-dedup.js`** — Create the CLI binary entry point. Should be a thin wrapper: add shebang line (`#!/usr/bin/env node`), require/import and execute `src/cli.ts` (compiled to `dist/cli.js`). | Status: not_done

---

## Phase 11: Test Fixtures

- [ ] **Create test fixture files** — Create all fixture files under `src/__tests__/fixtures/`: `prompts/simple-prompt.md` (a basic single-section prompt), `prompts/whitespace-variants/variant-1.md`, `variant-2.md`, `variant-3.md` (same prompt with different whitespace), `prompts/near-duplicates/support-v1.md`, `support-v2.md`, `support-v3.md` (near-duplicate prompts with similar but not identical text), `prompts/distinct-prompts/code-review.md`, `translator.md`, `summarizer.md` (completely different prompts), `prompts/templates/template-handlebars.md`, `template-jinja2.md`, `template-fstring.md` (same prompt with different template syntaxes), `prompts/message-arrays/simple-messages.json`, `multi-turn.json` (OpenAI message array format), `prompts/empty.md` (empty file), `prompts/large-prompt.md` (50KB+ for performance testing), `configs/valid-config.json`, `configs/custom-thresholds.json`. | Status: not_done

---

## Phase 12: Unit Tests — Normalization

- [x] **Test whitespace normalization (`src/__tests__/normalize/whitespace.test.ts`)** — Test: collapsing multiple spaces into one, collapsing tabs, collapsing `\r\n` to `\n`, trimming leading/trailing whitespace per line, collapsing multiple blank lines into one, removing leading/trailing blank lines, preserving whitespace inside fenced code blocks. Edge cases: empty string, string of only whitespace, no whitespace changes needed (idempotent). | Status: done

- [x] **Test case normalization (`src/__tests__/normalize/case.test.ts`)** — Test: converting uppercase to lowercase, preserving code block content, preserving template variable names, preserving quoted strings, preserving identifiers (camelCase, PascalCase, SCREAMING_SNAKE_CASE, kebab-case). Edge cases: empty string, all-lowercase input (no changes), mixed case with protected regions. | Status: done

- [x] **Test variable extraction (`src/__tests__/normalize/variables.test.ts`)** — Test each template syntax: Handlebars (`{{var}}`), Jinja2 (`{{ var }}`), f-string (`{var}`), dollar (`$var`, `${var}`). Test `auto` mode detection. Test multiple occurrences of the same variable mapping to the same placeholder. Test different variable names in identical structure mapping to same placeholders. Test false positive avoidance: JSON braces, code block content. Edge cases: empty string, no variables present, only variables, thousands of variables. | Status: done

- [x] **Test section ordering (`src/__tests__/normalize/section-order.test.ts`)** — Test: sections with markdown headers sorted alphabetically, sections with XML tags sorted, untitled sections left in place, content within sections preserved verbatim. Edge cases: prompt with no sections, prompt with one section, sections that are already in alphabetical order. | Status: done

- [x] **Test example ordering (`src/__tests__/normalize/example-order.test.ts`)** — Test: reordering numbered examples (`Example 1:`, `Example 2:`), reordering by content hash, preservation of individual example content. Edge cases: single example, no examples detected, examples already in canonical order. | Status: done

- [x] **Test formatting normalization (`src/__tests__/normalize/formatting.test.ts`)** — Test: stripping bold markers, stripping italic markers (both `*` and `_`), stripping strikethrough, stripping inline code backticks from non-code, normalizing list markers (`*`, `+` to `-`), normalizing numbered list markers, removing horizontal rules. Preservation of: code blocks, heading levels, formatting in quoted strings. Edge cases: empty string, no formatting present, mixed formatting. | Status: done

- [x] **Test full normalization pipeline (`src/__tests__/normalize/pipeline.test.ts`)** — Integration test: apply full pipeline with default steps enabled. Verify steps execute in correct order. Verify disabled steps are skipped. Verify that enabling additional steps (case, section-order, example-order) works. Verify idempotency: normalizing an already-normalized prompt produces no changes. Test with various `NormalizeOptions` configurations. | Status: done

---

## Phase 13: Unit Tests — Hashing

- [x] **Test SHA-256 hashing (`src/__tests__/hash/sha256.test.ts`)** — Test: identical inputs produce identical hashes, different inputs produce different hashes, output is a 64-character hex string, known test vectors (hash a known string and compare against expected SHA-256 output). | Status: done

- [ ] **Test xxHash64 (`src/__tests__/hash/xxhash64.test.ts`)** — Test: identical inputs produce identical hashes, different inputs produce different hashes, output is a 16-character hex string, verify against known xxHash64 test vectors if available. Test that the pure TypeScript implementation matches expected behavior. | Status: not_done

- [ ] **Test structural hash (`src/__tests__/hash/structural.test.ts`)** — Test: structural skeleton extraction preserves role markers, section headers, variable placeholders, and structural delimiters while removing instructional text. Test that two prompts with same structure but different text produce the same structural hash. Test that two prompts with different structures produce different structural hashes. | Status: not_done

- [x] **Test hash integration** — Test the full `hash()` function: returns `HashResult` with normalized, structural, and sections hashes. Verify prompts differing only in whitespace produce identical normalized hashes. Test both SHA-256 and xxHash64 algorithms. Verify `canonicalForm`, `stepsApplied`, `algorithm`, and `durationMs` fields. | Status: done

---

## Phase 14: Unit Tests — Similarity

- [x] **Test Jaccard similarity (`src/__tests__/similarity/jaccard.test.ts`)** — Test with known inputs: identical strings (1.0), completely different strings (0.0), partially overlapping strings (expected value). Edge cases: empty strings, single-word strings, strings with same words in different order (should still be 1.0). | Status: done

- [x] **Test shingling similarity (`src/__tests__/similarity/shingle.test.ts`)** — Test with known inputs at default shingle size (3). Test with custom shingle sizes. Test that word order matters (unlike Jaccard). Edge cases: prompts shorter than n-gram size, identical prompts, completely different prompts. | Status: done

- [x] **Test edit distance (`src/__tests__/similarity/edit-distance.test.ts`)** — Test with known inputs: identical strings (1.0), single character difference, completely different strings. Test the prefix/suffix fallback for strings exceeding `maxEditDistanceLength`. Edge cases: empty strings, one empty and one non-empty. | Status: done

- [x] **Test structural similarity (`src/__tests__/similarity/structural.test.ts`)** — Test: same roles in same order (1.0 role score), different roles (0.0), same section titles (high overlap), different section titles, same variable count vs. different, same example count vs. different. Test overall average computation. | Status: done

- [x] **Test composite similarity (`src/__tests__/similarity/composite.test.ts`)** — Test that composite score equals weighted sum of individual metrics. Test with default weights. Test with custom weights. Verify weights must sum to 1.0 (validation). Test `isDuplicate` field against threshold. Test `SimilarityResult` contains all expected fields including `durationMs`. | Status: done

---

## Phase 15: Unit Tests — Dedup Index

- [x] **Test DedupIndex core (`src/__tests__/dedup-index/index.test.ts`)** — Test `add()`: adding a new prompt returns `isDuplicate: false` with a new groupId; adding an exact duplicate returns `isDuplicate: true` with matching hash and groupId; adding a near-duplicate returns `isDuplicate: true` with similarity score above threshold. Test `find()`: returns match when above threshold, returns null when no match. Test `groups()` and `duplicateGroups()`: correct group counts and membership. Test `stats()`: totalAdded, uniqueGroups, duplicatesFound, deduplicationRate, memoryUsageBytes. Test `size()` and `clear()`. Test with `nearDuplicateDetection: false` (only exact hash matching). | Status: done

- [x] **Test serialization (`src/__tests__/dedup-index/serialization.test.ts`)** — Test `serialize()` returns a valid `SerializedIndex` object with version, algorithm, threshold, entries, and groups. Test `deserialize()` restores the index correctly. Test round-trip: create index, add prompts, serialize, deserialize, verify identical behavior (same results for `find()`, `groups()`, `stats()`). Test version field is present. | Status: done

- [x] **Test eviction (`src/__tests__/dedup-index/eviction.test.ts`)** — Test: when maxSize is exceeded, the oldest entries are evicted. Test with `maxSize: 1` (immediate eviction of previous). Test that evicted entries no longer appear in hash map lookups. Test that group membership records persist after eviction until `clear()`. | Status: done

---

## Phase 16: Unit Tests — Parser

- [ ] **Test format detector (`src/__tests__/parser/format-detector.test.ts`)** — Test detecting plain text strings, OpenAI-style message arrays, Anthropic-style prompt objects, and file path objects. Test text extraction from each format. Edge cases: empty string, empty message array, invalid format inputs. | Status: not_done

- [ ] **Test section detector (`src/__tests__/parser/section-detector.test.ts`)** — Test detecting markdown headers at various levels, XML tags, and labeled blocks. Test prompts with no sections, one section, many sections. Test correct title and content extraction. Test boundary detection accuracy. | Status: not_done

- [ ] **Test variable detector (`src/__tests__/parser/variable-detector.test.ts`)** — Test detecting variables in all four syntaxes (handlebars, jinja2, fstring, dollar). Test `auto` mode. Test false positive avoidance (JSON, code blocks). Test position and name extraction accuracy. | Status: not_done

---

## Phase 17: Unit Tests — CLI

- [ ] **Test CLI argument parsing (`src/__tests__/cli.test.ts`)** — Test parsing of all flags and options. Test `--analyze` mode with fixture files (verify output format and content). Test `--check` mode (verify exit code 1 when duplicates found, exit code 0 when clean). Test `--hash` mode (verify hash output, one per line). Test `--compare` mode (verify similarity output). Test `--format json` (verify valid JSON output). Test `--version` and `--help` flags. Test error handling: invalid flags (exit code 2), no input files, nonexistent file (exit code 2). Test stdin reading. Test environment variable overrides. Test config file loading. | Status: not_done

---

## Phase 18: Integration Tests

- [ ] **Exact duplicate integration test** — Add 10 prompts that differ only in whitespace to an index. Assert all are assigned to the same group. Assert dedup rate is 90%. Use fixture files from `whitespace-variants/`. | Status: not_done

- [ ] **Near-duplicate integration test** — Add 5 prompts that are textually similar (same structure, different phrasing) to an index. Assert they are grouped together. Assert similarity scores are above threshold. Use fixture files from `near-duplicates/`. | Status: not_done

- [ ] **Distinct prompt integration test** — Add 10 completely different prompts. Assert each is in its own group. Assert dedup rate is 0%. Use fixture files from `distinct-prompts/`. | Status: not_done

- [ ] **Mixed collection integration test** — Add a realistic collection of 50 prompts with some duplicates, some near-duplicates, and some unique prompts. Assert expected group counts and dedup rate within acceptable ranges. | Status: not_done

- [x] **Message array format integration test** — Test normalization and hashing of OpenAI-style message arrays. Assert that two message arrays with identical content but different whitespace produce the same hash. Use fixtures from `message-arrays/`. | Status: done

- [ ] **Anthropic format integration test** — Test normalization and hashing of Anthropic-style prompt objects with system field and messages array. | Status: not_done

- [x] **Template variable dedup integration test** — Test that two prompts with the same structure but different variable names (e.g., `{{user_name}}` vs `{{name}}`) produce the same hash after variable extraction. Use fixtures from `templates/`. | Status: done

- [ ] **CLI end-to-end integration test** — Run the compiled CLI binary against test fixture directories. Verify exit codes, stdout output format (human-readable and JSON), and correct duplicate detection. | Status: not_done

- [x] **Serialization round-trip integration test** — Create an index, add prompts, serialize to JSON, deserialize back, verify the restored index produces identical results for `find()`, `groups()`, `stats()`. | Status: done

- [x] **Idempotency integration test** — Normalize a prompt, then normalize the result again. Assert the second normalization produces no changes (canonical form is stable). Test across multiple prompt types and normalization configurations. | Status: done

---

## Phase 19: Edge Case Tests

- [x] **Empty prompt handling** — Test `normalize("")`, `hash("")`, `similarity("", "")`, `isDuplicate("", "")`, `index.add("")`. Verify no crashes, sensible defaults (e.g., empty canonical form, hash of empty string). | Status: done

- [x] **Whitespace-only prompt** — Test prompts that are only whitespace characters. After normalization should become empty. Verify hash and similarity behavior. | Status: done

- [x] **Template-variables-only prompt** — Test a prompt that consists entirely of template variables (`{{var1}} {{var2}} {{var3}}`). Verify normalization replaces all with placeholders. | Status: done

- [ ] **Large prompt performance test** — Test with a prompt exceeding 100KB. Verify normalization completes in under 3ms, hashing in under 0.1ms, similarity in under 2ms (or uses the fallback for edit distance). Use `large-prompt.md` fixture. | Status: not_done

- [x] **Identical prompts** — Test two completely identical prompts. Verify similarity score is exactly 1.0, isDuplicate is true, and hash values match. | Status: done

- [x] **Completely different prompts** — Test two prompts with no overlap. Verify similarity score is near 0.0 and isDuplicate is false. | Status: done

- [x] **Nested code blocks with template syntax** — Test a prompt containing code blocks with `{{variable}}` patterns inside them. Verify variable extraction does NOT replace variables inside code blocks. | Status: done

- [ ] **Binary/invalid file input** — Test passing a binary file path as input. Verify graceful error handling (not a crash). | Status: not_done

- [ ] **Nonexistent file input** — Test passing a file path that does not exist. Verify an appropriate error message and exit code 2 in CLI mode. | Status: not_done

- [x] **Index maxSize of 1** — Test creating an index with `maxSize: 1`. Verify immediate eviction of previous entry on each add. Verify that the most recently added entry is always findable. | Status: done

- [x] **Unicode content** — Test prompts with emoji, CJK characters, Arabic text. Verify normalization, hashing, and similarity work correctly without corruption or crashes. | Status: done

- [ ] **Prompt with thousands of template variables** — Test a prompt containing 1000+ template variables. Verify normalization completes without excessive slowdown or memory issues. | Status: not_done

---

## Phase 20: Documentation

- [x] **Create README.md** — Write comprehensive README with: package description, installation instructions (`npm install prompt-dedup`), quick start examples (normalize, hash, similarity, isDuplicate, createIndex), full API reference with type signatures, CLI usage guide with all flags and modes, configuration file format, environment variables, integration patterns (cache key normalization, Anthropic/OpenAI prefix caching, CI/CD, analytics), performance characteristics, and links to SPEC.md for detailed specification. | Status: done

- [x] **Add JSDoc comments to all public exports** — Ensure every exported function and type in `src/index.ts` and `src/types.ts` has complete JSDoc documentation including parameter descriptions, return value descriptions, and usage examples. | Status: done

- [ ] **Create example config file `.prompt-dedup.json`** — Create the example configuration file at the project root for self-testing, matching the format in spec section 11. | Status: not_done

---

## Phase 21: Build, Lint & CI Verification

- [ ] **Verify TypeScript compilation** — Run `npm run build` and confirm all source files compile without errors. Verify `dist/` output contains all expected `.js`, `.d.ts`, and `.d.ts.map` files. | Status: not_done

- [ ] **Verify lint passes** — Run `npm run lint` and fix any linting errors. Ensure all source files conform to ESLint rules. | Status: not_done

- [ ] **Verify all tests pass** — Run `npm run test` (vitest) and confirm all unit tests, integration tests, and edge case tests pass. Zero failures. | Status: not_done

- [ ] **Verify CLI binary works end-to-end** — Run `node bin/prompt-dedup.js --help`, `--version`, `--hash` with a test file, `--analyze` with fixture directory, `--check` mode, and `--compare` mode. Verify correct output and exit codes. | Status: not_done

---

## Phase 22: Version Bump & Publishing Prep

- [ ] **Bump version in package.json** — Bump version per the implementation phase (0.1.0 for Phase 1 deliverables, etc.). Ensure version matches spec's roadmap milestones. | Status: not_done

- [ ] **Verify `npm pack` output** — Run `npm pack --dry-run` to verify the published package includes only the `dist/` directory (per `"files": ["dist"]` in package.json) and `bin/prompt-dedup.js`. Verify no source files, test files, or fixtures leak into the published package. | Status: not_done

- [ ] **Verify `prepublishOnly` hook** — Confirm `npm run build` runs automatically before `npm publish` via the `prepublishOnly` script. | Status: not_done
