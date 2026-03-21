import { describe, it, expect } from 'vitest';
import { normalizeWhitespace } from '../normalize/whitespace';
import { normalizeCase } from '../normalize/case';
import { normalizeVariables } from '../normalize/variables';
import { normalizeSectionOrder } from '../normalize/section-order';
import { normalizeExampleOrder } from '../normalize/example-order';
import { normalizeFormatting } from '../normalize/formatting';
import { normalize } from '../normalize/index';

describe('normalizeWhitespace', () => {
  it('collapses multiple spaces into one', () => {
    expect(normalizeWhitespace('hello    world')).toBe('hello world');
  });

  it('collapses tabs', () => {
    expect(normalizeWhitespace('hello\t\tworld')).toBe('hello world');
  });

  it('normalizes \\r\\n to \\n', () => {
    expect(normalizeWhitespace('hello\r\nworld')).toBe('hello\nworld');
  });

  it('trims leading/trailing whitespace per line', () => {
    expect(normalizeWhitespace('  hello  \n  world  ')).toBe('hello\nworld');
  });

  it('collapses multiple blank lines into one', () => {
    expect(normalizeWhitespace('hello\n\n\n\nworld')).toBe('hello\n\nworld');
  });

  it('removes leading/trailing blank lines', () => {
    expect(normalizeWhitespace('\n\nhello\nworld\n\n')).toBe('hello\nworld');
  });

  it('handles empty string', () => {
    expect(normalizeWhitespace('')).toBe('');
  });

  it('handles whitespace-only string', () => {
    expect(normalizeWhitespace('   \n\n   \t  ')).toBe('');
  });

  it('preserves whitespace inside code blocks', () => {
    const input = 'text\n```\n  indented\n    code\n```\nmore text';
    const result = normalizeWhitespace(input);
    expect(result).toContain('  indented\n    code');
  });

  it('is idempotent', () => {
    const input = 'You are a helpful assistant.\n\n\n   Answer questions.   ';
    const first = normalizeWhitespace(input);
    const second = normalizeWhitespace(first);
    expect(first).toBe(second);
  });
});

describe('normalizeCase', () => {
  it('converts text to lowercase', () => {
    expect(normalizeCase('HELLO WORLD')).toBe('hello world');
  });

  it('preserves camelCase identifiers', () => {
    const result = normalizeCase('Use the getUserName method');
    expect(result).toContain('getUserName');
  });

  it('preserves SCREAMING_SNAKE_CASE', () => {
    const result = normalizeCase('Set MAX_RETRY_COUNT to 5');
    expect(result).toContain('MAX_RETRY_COUNT');
  });

  it('handles empty string', () => {
    expect(normalizeCase('')).toBe('');
  });
});

describe('normalizeVariables', () => {
  it('replaces handlebars variables with placeholders', () => {
    const result = normalizeVariables('Hello {{name}}, order {{id}}');
    expect(result).toBe('Hello {{VAR_0}}, order {{VAR_1}}');
  });

  it('maps same variable to same placeholder', () => {
    const result = normalizeVariables('{{name}} said hello to {{name}}');
    expect(result).toBe('{{VAR_0}} said hello to {{VAR_0}}');
  });

  it('different variable names in same structure produce same output', () => {
    const a = normalizeVariables('Hello {{user_name}}, your order {{order_id}} is ready');
    const b = normalizeVariables('Hello {{name}}, your order {{id}} is ready');
    expect(a).toBe(b);
  });

  it('handles dollar syntax', () => {
    const result = normalizeVariables('Hello $name, id is ${id}', 'dollar');
    expect(result).toBe('Hello {{VAR_0}}, id is {{VAR_1}}');
  });

  it('handles empty string', () => {
    expect(normalizeVariables('')).toBe('');
  });

  it('handles no variables', () => {
    expect(normalizeVariables('plain text')).toBe('plain text');
  });
});

describe('normalizeSectionOrder', () => {
  it('sorts sections alphabetically', () => {
    const input = '## Zebra\nContent Z\n\n## Alpha\nContent A';
    const result = normalizeSectionOrder(input);
    expect(result.indexOf('Alpha')).toBeLessThan(result.indexOf('Zebra'));
  });

  it('returns unchanged text with no sections', () => {
    const input = 'just plain text';
    expect(normalizeSectionOrder(input)).toBe(input);
  });

  it('returns unchanged text with one section', () => {
    const input = '## Only Section\nSome content';
    // Single titled section should not change
    expect(normalizeSectionOrder(input)).toContain('Only Section');
  });
});

describe('normalizeExampleOrder', () => {
  it('handles text with no examples', () => {
    const input = 'Just regular text';
    expect(normalizeExampleOrder(input)).toBe(input);
  });

  it('handles empty string', () => {
    expect(normalizeExampleOrder('')).toBe('');
  });
});

describe('normalizeFormatting', () => {
  it('strips bold markers', () => {
    expect(normalizeFormatting('**bold text**')).toBe('bold text');
  });

  it('strips italic markers (asterisks)', () => {
    expect(normalizeFormatting('use *italic* here')).toBe('use italic here');
  });

  it('strips italic markers (underscores)', () => {
    expect(normalizeFormatting('use _italic_ here')).toBe('use italic here');
  });

  it('strips strikethrough', () => {
    expect(normalizeFormatting('~~removed~~')).toBe('removed');
  });

  it('normalizes list markers', () => {
    const input = '* Item one\n+ Item two\n- Item three';
    const result = normalizeFormatting(input);
    expect(result).toBe('- Item one\n- Item two\n- Item three');
  });

  it('normalizes numbered list markers', () => {
    const input = '1) First\n2) Second';
    const result = normalizeFormatting(input);
    expect(result).toBe('1. First\n2. Second');
  });

  it('removes horizontal rules', () => {
    const input = 'text\n---\nmore text';
    const result = normalizeFormatting(input);
    expect(result).not.toContain('---');
  });

  it('handles empty string', () => {
    expect(normalizeFormatting('')).toBe('');
  });
});

describe('normalize (full pipeline)', () => {
  it('applies default steps (whitespace, variables, formatting)', () => {
    const result = normalize(
      'You are a helpful assistant.\n\n\n   Answer questions clearly.   \n',
    );
    expect(result).toBe('You are a helpful assistant.\n\nAnswer questions clearly.');
  });

  it('normalizes variables in pipeline', () => {
    const result = normalize('Hello {{user_name}}, your order {{order_id}} is ready.');
    expect(result).toBe('Hello {{VAR_0}}, your order {{VAR_1}} is ready.');
  });

  it('is idempotent', () => {
    const input = 'Some **bold** text with {{var}} and   spaces';
    const first = normalize(input);
    const second = normalize(first);
    expect(first).toBe(second);
  });

  it('respects disabled steps', () => {
    const result = normalize('Hello {{name}}', { steps: { variables: false } });
    expect(result).toContain('{{name}}');
    expect(result).not.toContain('{{VAR_0}}');
  });

  it('supports message array input', () => {
    const result = normalize([
      { role: 'system', content: 'You are   helpful.' },
      { role: 'user', content: 'Hello   world.' },
    ]);
    expect(result).toContain('You are helpful.');
    expect(result).toContain('Hello world.');
  });
});
