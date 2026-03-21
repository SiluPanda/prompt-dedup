import { describe, it, expect } from 'vitest';
import { hash, sha256 } from '../hash/index';

describe('sha256', () => {
  it('returns a 64-character hex string', () => {
    const result = sha256('hello');
    expect(result).toHaveLength(64);
    expect(result).toMatch(/^[a-f0-9]{64}$/);
  });

  it('produces deterministic output', () => {
    expect(sha256('test')).toBe(sha256('test'));
  });

  it('different inputs produce different hashes', () => {
    expect(sha256('hello')).not.toBe(sha256('world'));
  });

  it('matches known SHA-256 test vector', () => {
    // SHA-256 of empty string
    expect(sha256('')).toBe(
      'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    );
  });
});

describe('hash', () => {
  it('returns a HashResult with all fields', () => {
    const result = hash('You are a helpful assistant.');
    expect(result).toHaveProperty('normalized');
    expect(result).toHaveProperty('structural');
    expect(result).toHaveProperty('sections');
    expect(result).toHaveProperty('canonicalForm');
    expect(result).toHaveProperty('algorithm');
    expect(result).toHaveProperty('stepsApplied');
    expect(result).toHaveProperty('durationMs');
  });

  it('defaults to sha256 algorithm', () => {
    const result = hash('test');
    expect(result.algorithm).toBe('sha256');
  });

  it('produces deterministic hashes', () => {
    const a = hash('You are helpful.');
    const b = hash('You are helpful.');
    expect(a.normalized).toBe(b.normalized);
    expect(a.structural).toBe(b.structural);
  });

  it('prompts differing only in whitespace produce same hash', () => {
    const a = hash('You are a helpful assistant.\n\nAnswer questions.');
    const b = hash('You are a helpful assistant.\n\n\n   Answer questions.   ');
    expect(a.normalized).toBe(b.normalized);
  });

  it('different prompts produce different hashes', () => {
    const a = hash('You are a code reviewer.');
    const b = hash('You are a translator.');
    expect(a.normalized).not.toBe(b.normalized);
  });

  it('includes stepsApplied in result', () => {
    const result = hash('test');
    expect(result.stepsApplied).toContain('whitespace');
    expect(result.stepsApplied).toContain('variables');
    expect(result.stepsApplied).toContain('formatting');
  });

  it('includes canonicalForm in result', () => {
    const result = hash('  hello  ');
    expect(result.canonicalForm).toBe('hello');
  });

  it('records duration', () => {
    const result = hash('test prompt');
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('supports xxhash64 algorithm option', () => {
    const result = hash('test', { algorithm: 'xxhash64' });
    expect(result.algorithm).toBe('xxhash64');
    expect(result.normalized).toHaveLength(16);
  });

  it('computes per-section hashes', () => {
    const result = hash('## Section A\nContent A\n\n## Section B\nContent B');
    expect(result.sections.length).toBeGreaterThan(0);
  });
});
