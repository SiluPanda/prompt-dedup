import { describe, it, expect } from 'vitest';
import { DedupIndex } from '../dedup-index/index';

describe('DedupIndex', () => {
  describe('add', () => {
    it('first prompt is not a duplicate', () => {
      const index = new DedupIndex();
      const result = index.add('You are a helpful assistant.');
      expect(result.isDuplicate).toBe(false);
      expect(result.hash).toBeTruthy();
      expect(result.groupId).toBeTruthy();
    });

    it('exact duplicate returns isDuplicate true', () => {
      const index = new DedupIndex();
      index.add('You are a helpful assistant.');
      const result = index.add('You are a helpful assistant.');
      expect(result.isDuplicate).toBe(true);
      expect(result.similarity).toBe(1.0);
    });

    it('whitespace-only difference is an exact duplicate', () => {
      const index = new DedupIndex();
      const r1 = index.add('Hello world.');
      const r2 = index.add('Hello   world.');
      expect(r2.isDuplicate).toBe(true);
      expect(r1.hash).toBe(r2.hash);
    });

    it('assigns same groupId to duplicates', () => {
      const index = new DedupIndex();
      const r1 = index.add('Test prompt.');
      const r2 = index.add('Test prompt.');
      expect(r1.groupId).toBe(r2.groupId);
    });

    it('assigns different groupIds to distinct prompts', () => {
      const index = new DedupIndex();
      const r1 = index.add('You are a code reviewer.');
      const r2 = index.add('You are a translator.');
      expect(r1.groupId).not.toBe(r2.groupId);
    });
  });

  describe('find', () => {
    it('returns match for exact duplicate', () => {
      const index = new DedupIndex();
      index.add('You are helpful.');
      const result = index.find('You are helpful.');
      expect(result).not.toBeNull();
      expect(result!.similarity).toBe(1.0);
    });

    it('returns null for no match', () => {
      const index = new DedupIndex();
      index.add('You are a code reviewer.');
      const result = index.find('Completely different prompt.');
      expect(result).toBeNull();
    });

    it('does not add to the index', () => {
      const index = new DedupIndex();
      index.add('First prompt.');
      index.find('Second prompt.');
      expect(index.size()).toBe(1);
    });
  });

  describe('groups', () => {
    it('returns all groups', () => {
      const index = new DedupIndex();
      index.add('Prompt A.');
      index.add('Prompt B.');
      const groups = index.groups();
      expect(groups.length).toBe(2);
    });

    it('exact duplicates do not inflate group member count', () => {
      const index = new DedupIndex();
      index.add('Prompt A.');
      index.add('Prompt A.');
      const groups = index.groups();
      expect(groups.length).toBe(1);
      // Same hash added twice should NOT duplicate in members
      expect(groups[0].count).toBe(1);
      expect(groups[0].members.length).toBe(1);
      // But duplicatesFound tracks the occurrence
      expect(index.stats().duplicatesFound).toBe(1);
    });
  });

  describe('stats', () => {
    it('tracks totalAdded correctly', () => {
      const index = new DedupIndex();
      index.add('Prompt A.');
      index.add('Prompt B.');
      index.add('Prompt A.');
      const stats = index.stats();
      expect(stats.totalAdded).toBe(3);
    });

    it('tracks duplicatesFound correctly', () => {
      const index = new DedupIndex();
      index.add('Prompt A.');
      index.add('Prompt A.');
      const stats = index.stats();
      expect(stats.duplicatesFound).toBe(1);
    });

    it('computes deduplication rate', () => {
      const index = new DedupIndex();
      index.add('Prompt A.');
      index.add('Prompt A.');
      const stats = index.stats();
      expect(stats.deduplicationRate).toBe(0.5);
    });

    it('has memoryUsageBytes', () => {
      const index = new DedupIndex();
      index.add('Prompt A.');
      const stats = index.stats();
      expect(stats.memoryUsageBytes).toBeGreaterThan(0);
    });
  });

  describe('size and clear', () => {
    it('size reflects entry count', () => {
      const index = new DedupIndex();
      expect(index.size()).toBe(0);
      index.add('A.');
      expect(index.size()).toBe(1);
      index.add('B.');
      expect(index.size()).toBe(2);
    });

    it('clear resets the index', () => {
      const index = new DedupIndex();
      index.add('A.');
      index.add('B.');
      index.clear();
      expect(index.size()).toBe(0);
      expect(index.groups().length).toBe(0);
      expect(index.stats().totalAdded).toBe(0);
    });
  });

  describe('serialization', () => {
    it('serialize returns valid structure', () => {
      const index = new DedupIndex();
      index.add('Test prompt.');
      const serialized = index.serialize();
      expect(serialized.version).toBe(1);
      expect(serialized.algorithm).toBe('sha256');
      expect(serialized.entries.length).toBe(1);
      expect(serialized.groups.length).toBe(1);
    });

    it('round-trip preserves index state', () => {
      const index = new DedupIndex();
      index.add('Prompt A.');
      index.add('Prompt B.');
      index.add('Prompt A.'); // duplicate

      const serialized = index.serialize();
      const restored = DedupIndex.deserialize(serialized);

      // find should work on restored index
      const found = restored.find('Prompt A.');
      expect(found).not.toBeNull();
      expect(found!.similarity).toBe(1.0);

      // Stats should be reasonable
      expect(restored.size()).toBe(2);
      expect(restored.groups().length).toBe(2);
    });

    it('round-trip preserves totalAdded and duplicatesFound', () => {
      const index = new DedupIndex();
      index.add('Alpha prompt.');
      index.add('Beta prompt.');
      index.add('Alpha prompt.'); // exact dup

      const origStats = index.stats();
      expect(origStats.totalAdded).toBe(3);
      expect(origStats.duplicatesFound).toBe(1);

      const serialized = index.serialize();
      expect(serialized.totalAdded).toBe(3);
      expect(serialized.duplicatesFound).toBe(1);

      const restored = DedupIndex.deserialize(serialized);
      const restoredStats = restored.stats();
      expect(restoredStats.totalAdded).toBe(3);
      expect(restoredStats.duplicatesFound).toBe(1);
      expect(restoredStats.deduplicationRate).toBeCloseTo(1 / 3);
    });
  });

  describe('eviction', () => {
    it('evicts oldest entries when maxSize exceeded', () => {
      const index = new DedupIndex({ maxSize: 2 });
      index.add('Prompt A.');
      index.add('Prompt B.');
      index.add('Prompt C.');
      // A should be evicted
      expect(index.size()).toBe(2);
      // C should be findable
      const found = index.find('Prompt C.');
      expect(found).not.toBeNull();
    });

    it('maxSize 1 keeps only the latest entry', () => {
      const index = new DedupIndex({ maxSize: 1 });
      index.add('Prompt A.');
      index.add('Prompt B.');
      expect(index.size()).toBe(1);
      const found = index.find('Prompt B.');
      expect(found).not.toBeNull();
    });
  });

  describe('nearDuplicateDetection: false', () => {
    it('only uses exact hash matching', () => {
      const index = new DedupIndex({ nearDuplicateDetection: false });
      index.add('You are a helpful assistant. Answer questions clearly.');
      const result = index.add('You are a helpful assistant. Answer questions concisely.');
      // Without near-duplicate detection, this should not match
      expect(result.isDuplicate).toBe(false);
    });
  });
});
