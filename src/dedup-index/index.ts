import type {
  PromptInput,
  IndexOptions,
  AddResult,
  FindResult,
  DedupGroup,
  DedupStats,
  SerializedIndex,
  IndexEntry,
} from '../types';
import { hash as computeHash } from '../hash/index';
import { similarity as computeSimilarity } from '../similarity/index';
import { GroupManager } from './group-manager';
import { EvictionManager } from './eviction';

/**
 * In-memory dedup index for efficient batch deduplication.
 */
export class DedupIndex {
  private entries = new Map<string, IndexEntry>();
  private canonicalForms: Array<{ hash: string; canonical: string }> = [];
  private groupManager = new GroupManager();
  private evictionManager = new EvictionManager();
  private options: Required<Pick<IndexOptions, 'threshold' | 'maxSize' | 'nearDuplicateDetection' | 'algorithm'>>;
  private normalizeOptions: IndexOptions;
  private totalAdded = 0;
  private duplicatesFound = 0;

  constructor(options?: IndexOptions) {
    this.normalizeOptions = options ?? {};
    this.options = {
      threshold: options?.threshold ?? 0.85,
      maxSize: options?.maxSize ?? 100000,
      nearDuplicateDetection: options?.nearDuplicateDetection ?? true,
      algorithm: options?.algorithm ?? 'sha256',
    };
  }

  /**
   * Add a prompt to the index.
   */
  add(prompt: PromptInput, metadata?: Record<string, unknown>): AddResult {
    this.totalAdded++;

    const hashResult = computeHash(prompt, this.normalizeOptions);
    const normalizedHash = hashResult.normalized;
    const canonicalForm = hashResult.canonicalForm;

    // Check for exact hash match
    const existing = this.entries.get(normalizedHash);
    if (existing) {
      this.duplicatesFound++;
      const groupId = this.groupManager.getGroupForHash(normalizedHash)!;
      // Hash is already a member of its group — don't re-add (would duplicate in members array)

      return {
        hash: normalizedHash,
        isDuplicate: true,
        duplicateOf: normalizedHash,
        similarity: 1.0,
        groupId,
      };
    }

    // Check for near-duplicate via similarity scanning
    if (this.options.nearDuplicateDetection && this.canonicalForms.length > 0) {
      let bestMatch: { hash: string; similarity: number; groupId: string } | null = null;

      for (const entry of this.canonicalForms) {
        const simResult = computeSimilarity(canonicalForm, entry.canonical, {
          threshold: this.options.threshold,
        });

        if (simResult.score >= this.options.threshold) {
          const entryGroupId = this.groupManager.getGroupForHash(entry.hash);
          if (entryGroupId && (!bestMatch || simResult.score > bestMatch.similarity)) {
            bestMatch = {
              hash: entry.hash,
              similarity: simResult.score,
              groupId: entryGroupId,
            };
          }
        }
      }

      if (bestMatch) {
        this.duplicatesFound++;

        // Add entry to the index
        const indexEntry: IndexEntry = {
          hash: normalizedHash,
          canonicalForm,
          groupId: bestMatch.groupId,
          metadata,
          addedAt: new Date().toISOString(),
        };
        this.entries.set(normalizedHash, indexEntry);
        this.canonicalForms.push({ hash: normalizedHash, canonical: canonicalForm });
        this.evictionManager.trackInsertion(normalizedHash);
        this.groupManager.addToGroup(bestMatch.groupId, normalizedHash);

        // Handle eviction
        if (this.entries.size > this.options.maxSize) {
          this.performEviction();
        }

        return {
          hash: normalizedHash,
          isDuplicate: true,
          duplicateOf: bestMatch.hash,
          similarity: bestMatch.similarity,
          groupId: bestMatch.groupId,
        };
      }
    }

    // New unique prompt
    const groupId = this.groupManager.createGroup(normalizedHash);
    const indexEntry: IndexEntry = {
      hash: normalizedHash,
      canonicalForm,
      groupId,
      metadata,
      addedAt: new Date().toISOString(),
    };

    this.entries.set(normalizedHash, indexEntry);
    this.canonicalForms.push({ hash: normalizedHash, canonical: canonicalForm });
    this.evictionManager.trackInsertion(normalizedHash);

    // Handle eviction
    if (this.entries.size > this.options.maxSize) {
      this.performEviction();
    }

    return {
      hash: normalizedHash,
      isDuplicate: false,
      groupId,
    };
  }

  /**
   * Find the nearest match for a prompt without adding it.
   */
  find(prompt: PromptInput): FindResult | null {
    const hashResult = computeHash(prompt, this.normalizeOptions);
    const normalizedHash = hashResult.normalized;
    const canonicalForm = hashResult.canonicalForm;

    // Exact match
    const existing = this.entries.get(normalizedHash);
    if (existing) {
      const groupId = this.groupManager.getGroupForHash(normalizedHash)!;
      return {
        hash: normalizedHash,
        similarity: 1.0,
        groupId,
        canonicalForm: existing.canonicalForm,
      };
    }

    // Near-duplicate scan
    if (!this.options.nearDuplicateDetection) return null;

    let bestMatch: FindResult | null = null;

    for (const entry of this.canonicalForms) {
      const simResult = computeSimilarity(canonicalForm, entry.canonical, {
        threshold: this.options.threshold,
      });

      if (simResult.score >= this.options.threshold) {
        const entryGroupId = this.groupManager.getGroupForHash(entry.hash);
        const entryData = this.entries.get(entry.hash);
        if (entryGroupId && entryData && (!bestMatch || simResult.score > bestMatch.similarity)) {
          bestMatch = {
            hash: entry.hash,
            similarity: simResult.score,
            groupId: entryGroupId,
            canonicalForm: entryData.canonicalForm,
          };
        }
      }
    }

    return bestMatch;
  }

  /**
   * Returns all dedup groups.
   */
  groups(): DedupGroup[] {
    return this.groupManager.getAllGroups();
  }

  /**
   * Returns groups with more than one member.
   */
  duplicateGroups(): DedupGroup[] {
    return this.groupManager.getDuplicateGroups();
  }

  /**
   * Returns dedup statistics.
   */
  stats(): DedupStats {
    const totalAdded = this.totalAdded;
    const uniqueGroups = this.groupManager.groupCount();
    const duplicatesFound = this.duplicatesFound;
    const deduplicationRate = totalAdded > 0 ? duplicatesFound / totalAdded : 0;

    // Rough memory estimate
    let memoryUsageBytes = 0;
    for (const [hash, entry] of this.entries) {
      memoryUsageBytes += hash.length * 2; // UTF-16
      memoryUsageBytes += entry.canonicalForm.length * 2;
      memoryUsageBytes += entry.groupId.length * 2;
      memoryUsageBytes += 100; // overhead
    }

    return {
      totalAdded,
      uniqueGroups,
      duplicatesFound,
      deduplicationRate,
      memoryUsageBytes,
    };
  }

  /**
   * Returns the number of entries in the index.
   */
  size(): number {
    return this.entries.size;
  }

  /**
   * Removes all entries from the index.
   */
  clear(): void {
    this.entries.clear();
    this.canonicalForms = [];
    this.groupManager.clear();
    this.evictionManager.clear();
    this.totalAdded = 0;
    this.duplicatesFound = 0;
  }

  /**
   * Serializes the index to a JSON-compatible object.
   */
  serialize(): SerializedIndex {
    const entries = Array.from(this.entries.values()).map((e) => ({
      hash: e.hash,
      canonicalForm: e.canonicalForm,
      groupId: e.groupId,
      metadata: e.metadata,
      addedAt: e.addedAt,
    }));

    return {
      version: 1,
      algorithm: this.options.algorithm,
      threshold: this.options.threshold,
      entries,
      groups: this.groupManager.getAllGroups(),
      totalAdded: this.totalAdded,
      duplicatesFound: this.duplicatesFound,
    };
  }

  /**
   * Restores the index from a serialized object.
   */
  static deserialize(data: SerializedIndex, options?: IndexOptions): DedupIndex {
    const index = new DedupIndex({
      ...options,
      algorithm: data.algorithm,
      threshold: data.threshold,
    });

    // Restore groups
    index.groupManager.restore(data.groups);

    // Restore entries
    for (const entry of data.entries) {
      const indexEntry: IndexEntry = {
        hash: entry.hash,
        canonicalForm: entry.canonicalForm,
        groupId: entry.groupId,
        metadata: entry.metadata,
        addedAt: entry.addedAt,
      };
      index.entries.set(entry.hash, indexEntry);
      index.canonicalForms.push({ hash: entry.hash, canonical: entry.canonicalForm });
    }

    // Restore eviction order
    index.evictionManager.restore(data.entries as IndexEntry[]);

    // Restore counters (use stored values if available, fall back to computed)
    if (data.totalAdded !== undefined) {
      index.totalAdded = data.totalAdded;
      index.duplicatesFound = data.duplicatesFound ?? 0;
    } else {
      index.totalAdded = data.entries.length;
      const totalMembers = data.groups.reduce((sum, g) => sum + g.count, 0);
      index.duplicatesFound = totalMembers - data.groups.length;
    }

    return index;
  }

  private performEviction(): void {
    const evicted = this.evictionManager.evict(this.entries, this.options.maxSize);
    // Remove evicted entries from canonical forms list
    const evictedSet = new Set(evicted);
    this.canonicalForms = this.canonicalForms.filter((cf) => !evictedSet.has(cf.hash));
  }
}
