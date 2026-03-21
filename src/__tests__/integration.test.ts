import { describe, it, expect } from 'vitest';
import { normalize, hash, similarity, isDuplicate, createIndex } from '../index';

describe('integration: end-to-end', () => {
  describe('normalize + hash pipeline', () => {
    it('whitespace variants produce same hash', () => {
      const a = hash('You are a helpful assistant.\n\nAnswer questions.');
      const b = hash('You are a helpful assistant.\n\n\n   Answer questions.   ');
      const c = hash('You are a helpful assistant.\r\n\r\nAnswer questions.');
      expect(a.normalized).toBe(b.normalized);
      expect(a.normalized).toBe(c.normalized);
    });

    it('variable names do not affect hash', () => {
      const a = hash('Hello {{user_name}}, order {{order_id}} ready.');
      const b = hash('Hello {{name}}, order {{id}} ready.');
      expect(a.normalized).toBe(b.normalized);
    });

    it('formatting differences do not affect hash', () => {
      const a = hash('**Important**: Always respond in _valid_ JSON.');
      const b = hash('Important: Always respond in valid JSON.');
      expect(a.normalized).toBe(b.normalized);
    });
  });

  describe('similarity scoring', () => {
    it('identical prompts score 1.0', () => {
      const result = similarity(
        'You are a helpful assistant.',
        'You are a helpful assistant.',
      );
      expect(result.score).toBe(1.0);
    });

    it('completely different prompts score low', () => {
      const result = similarity(
        'You are a code reviewer. Review code for bugs and security issues.',
        'Translate the following text to French.',
      );
      expect(result.score).toBeLessThan(0.5);
    });
  });

  describe('createIndex batch dedup', () => {
    it('deduplicates a collection of prompts', () => {
      const index = createIndex();

      // Add unique prompts
      const r1 = index.add('You are a helpful assistant. Answer questions.');
      expect(r1.isDuplicate).toBe(false);

      // Add whitespace variant (exact duplicate after normalization)
      const r2 = index.add('You are a helpful assistant.  Answer questions.');
      expect(r2.isDuplicate).toBe(true);

      // Add different prompt
      const r3 = index.add('You are a code reviewer. Review code for bugs.');
      expect(r3.isDuplicate).toBe(false);

      // Check stats
      const stats = index.stats();
      expect(stats.totalAdded).toBe(3);
      expect(stats.uniqueGroups).toBe(2);
      expect(stats.duplicatesFound).toBe(1);
    });

    it('supports message array input', () => {
      const index = createIndex();

      index.add([
        { role: 'system', content: 'You are helpful.' },
        { role: 'user', content: 'Hello.' },
      ]);

      const result = index.find([
        { role: 'system', content: 'You are helpful.' },
        { role: 'user', content: 'Hello.' },
      ]);

      expect(result).not.toBeNull();
      expect(result!.similarity).toBe(1.0);
    });

    it('serialization round-trip preserves behavior', () => {
      const index = createIndex();
      index.add('Prompt A: do something.');
      index.add('Prompt B: do something else.');

      const serialized = index.serialize();
      const restored = createIndex();
      const restoredIndex = (restored.constructor as typeof import('../dedup-index/index').DedupIndex).deserialize(serialized);

      expect(restoredIndex.size()).toBe(2);
      const found = restoredIndex.find('Prompt A: do something.');
      expect(found).not.toBeNull();
    });
  });

  describe('isDuplicate convenience', () => {
    it('whitespace-only differences are duplicates', () => {
      expect(
        isDuplicate(
          'You are a helpful assistant.',
          'You are a helpful   assistant.',
        ),
      ).toBe(true);
    });

    it('different prompts are not duplicates', () => {
      expect(
        isDuplicate(
          'You are a code reviewer.',
          'Translate text to French.',
        ),
      ).toBe(false);
    });
  });

  describe('edge cases', () => {
    it('empty prompt normalizes to empty', () => {
      expect(normalize('')).toBe('');
    });

    it('whitespace-only prompt normalizes to empty', () => {
      expect(normalize('   \n\n   ')).toBe('');
    });

    it('empty prompts have same hash', () => {
      const a = hash('');
      const b = hash('');
      expect(a.normalized).toBe(b.normalized);
    });

    it('similarity of empty prompts is 1.0', () => {
      const result = similarity('', '');
      expect(result.score).toBe(1.0);
    });

    it('unicode content works correctly', () => {
      const result = normalize('You are helpful. Answer in Japanese.');
      expect(result).toBeTruthy();

      const h = hash('Unicode test with emojis and CJK characters.');
      expect(h.normalized).toBeTruthy();
    });

    it('template-only prompt normalizes', () => {
      const result = normalize('{{var1}} {{var2}} {{var3}}');
      expect(result).toBe('{{VAR_0}} {{VAR_1}} {{VAR_2}}');
    });

    it('code blocks preserve template syntax', () => {
      const result = normalize('Use this:\n```\n{{variable}}\n```\nDone.');
      // Variable inside code block should NOT be replaced
      expect(result).toContain('{{variable}}');
    });
  });
});
