import { describe, it, expect } from 'vitest';
import { similarity, isDuplicate } from '../similarity/index';
import { jaccardSimilarity } from '../similarity/jaccard';
import { shingleSimilarity } from '../similarity/shingle';
import { editDistanceSimilarity } from '../similarity/edit-distance';
import { structuralSimilarity } from '../similarity/structural';

describe('jaccardSimilarity', () => {
  it('identical strings return 1.0', () => {
    expect(jaccardSimilarity('hello world', 'hello world')).toBe(1.0);
  });

  it('completely different strings return 0.0', () => {
    expect(jaccardSimilarity('abc def', 'xyz uvw')).toBe(0.0);
  });

  it('partially overlapping strings return between 0 and 1', () => {
    const score = jaccardSimilarity('hello world foo', 'hello world bar');
    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThan(1);
  });

  it('same words different order returns 1.0', () => {
    expect(jaccardSimilarity('cat sat mat', 'mat cat sat')).toBe(1.0);
  });

  it('empty strings return 1.0', () => {
    expect(jaccardSimilarity('', '')).toBe(1.0);
  });

  it('one empty string returns 0.0', () => {
    expect(jaccardSimilarity('hello', '')).toBe(0.0);
  });
});

describe('shingleSimilarity', () => {
  it('identical strings return 1.0', () => {
    expect(shingleSimilarity('hello world foo bar', 'hello world foo bar')).toBe(1.0);
  });

  it('completely different strings return 0.0', () => {
    expect(shingleSimilarity('aaa bbb ccc ddd', 'xxx yyy zzz www')).toBe(0.0);
  });

  it('captures word order sensitivity', () => {
    const a = 'the cat sat on the mat';
    const b = 'the mat sat on the cat';
    const score = shingleSimilarity(a, b);
    // Shingles differ, so score should be < 1.0
    expect(score).toBeLessThan(1.0);
  });

  it('handles texts shorter than shingle size', () => {
    const score = shingleSimilarity('hello world', 'hello world', 3);
    expect(score).toBe(1.0);
  });
});

describe('editDistanceSimilarity', () => {
  it('identical strings return 1.0', () => {
    expect(editDistanceSimilarity('hello', 'hello')).toBe(1.0);
  });

  it('single character difference', () => {
    const score = editDistanceSimilarity('hello', 'hallo');
    expect(score).toBeGreaterThan(0.7);
    expect(score).toBeLessThan(1.0);
  });

  it('completely different strings', () => {
    const score = editDistanceSimilarity('abc', 'xyz');
    expect(score).toBe(0.0);
  });

  it('empty strings return 1.0', () => {
    expect(editDistanceSimilarity('', '')).toBe(1.0);
  });

  it('one empty string returns 0.0', () => {
    expect(editDistanceSimilarity('hello', '')).toBe(0.0);
  });
});

describe('structuralSimilarity', () => {
  it('identical structures return high score', () => {
    const a = '## Instructions\nDo something\n\n## Examples\nExample here';
    const b = '## Instructions\nDo other thing\n\n## Examples\nOther example';
    const score = structuralSimilarity(a, b);
    expect(score).toBeGreaterThan(0.5);
  });

  it('plain text without structure returns 1.0 for matching', () => {
    const score = structuralSimilarity('simple text', 'other text');
    expect(score).toBe(1.0); // Both have no roles, no sections, no vars, no examples
  });
});

describe('similarity (composite)', () => {
  it('identical prompts return 1.0', () => {
    const result = similarity('You are helpful.', 'You are helpful.');
    expect(result.score).toBe(1.0);
    expect(result.isDuplicate).toBe(true);
  });

  it('whitespace-only differences produce high similarity', () => {
    const result = similarity(
      'You are a helpful assistant.\n\nAnswer questions.',
      'You are a helpful assistant.\n\n\n   Answer questions.   ',
    );
    expect(result.score).toBeGreaterThan(0.9);
    expect(result.isDuplicate).toBe(true);
  });

  it('completely different prompts produce low similarity', () => {
    const result = similarity(
      'You are a code reviewer. Review code for bugs.',
      'Translate the following text to French.',
    );
    expect(result.score).toBeLessThan(0.5);
    expect(result.isDuplicate).toBe(false);
  });

  it('near-duplicate prompts score above default threshold', () => {
    const result = similarity(
      'You are a helpful assistant. Answer questions clearly.',
      'You are a helpful assistant. Answer questions concisely.',
    );
    expect(result.score).toBeGreaterThan(0.7);
  });

  it('returns all expected fields', () => {
    const result = similarity('test a', 'test b');
    expect(result).toHaveProperty('score');
    expect(result).toHaveProperty('jaccard');
    expect(result).toHaveProperty('shingle');
    expect(result).toHaveProperty('editDistance');
    expect(result).toHaveProperty('structural');
    expect(result).toHaveProperty('isDuplicate');
    expect(result).toHaveProperty('threshold');
    expect(result).toHaveProperty('durationMs');
  });

  it('respects custom threshold', () => {
    const result = similarity('hello world', 'hello world!', {
      threshold: 0.99,
    });
    // Score is high but might be below 0.99 threshold
    expect(typeof result.isDuplicate).toBe('boolean');
    expect(result.threshold).toBe(0.99);
  });

  it('normalizes score by total weight when custom weights sum > 1.0', () => {
    // Partial custom weights get spread over defaults, total > 1.0
    const result = similarity(
      'You are a helpful assistant.',
      'You are a helpful assistant.',
      { weights: { jaccard: 0.5 } },
    );
    expect(result.score).toBeLessThanOrEqual(1.0);
    expect(result.score).toBeGreaterThanOrEqual(0.0);
  });

  it('normalizes score for arbitrary large custom weights', () => {
    const result = similarity(
      'You are a helpful assistant. Answer questions.',
      'You are a helpful assistant. Answer questions clearly.',
      { weights: { jaccard: 2.0, shingle: 2.0, edit: 1.0, structure: 1.0 } },
    );
    expect(result.score).toBeLessThanOrEqual(1.0);
    expect(result.score).toBeGreaterThanOrEqual(0.0);
  });

  it('returns 0 when all weights are zero', () => {
    const result = similarity(
      'You are a helpful assistant.',
      'You are a helpful assistant.',
      { weights: { jaccard: 0, shingle: 0, edit: 0, structure: 0 } },
    );
    expect(result.score).toBe(0);
  });
});

describe('isDuplicate', () => {
  it('returns true for identical prompts', () => {
    expect(isDuplicate('You are helpful.', 'You are helpful.')).toBe(true);
  });

  it('returns true for whitespace-only differences', () => {
    expect(
      isDuplicate(
        'You are a helpful assistant.',
        'You are a helpful   assistant.',
      ),
    ).toBe(true);
  });

  it('returns false for different prompts', () => {
    expect(
      isDuplicate('You are a code reviewer.', 'You are a translator.'),
    ).toBe(false);
  });
});
