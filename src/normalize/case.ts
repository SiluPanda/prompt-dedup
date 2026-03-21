import { detectProtectedRegions, transformUnprotected } from '../utils/protected-regions';

/**
 * Normalize case: convert non-protected text to lowercase.
 * Preserves code blocks, quoted strings, and identifiers.
 */
export function normalizeCase(text: string): string {
  if (!text) return '';

  const regions = detectProtectedRegions(text);
  return transformUnprotected(text, regions, (segment) => {
    // Lowercase the segment but preserve identifiers
    return segment.replace(/\S+/g, (word) => {
      if (isIdentifier(word)) return word;
      return word.toLowerCase();
    });
  });
}

/**
 * Check if a word looks like a programming identifier.
 * Matches camelCase, PascalCase, SCREAMING_SNAKE_CASE, kebab-case.
 */
function isIdentifier(word: string): boolean {
  // SCREAMING_SNAKE_CASE: all caps with underscores, at least one underscore
  if (/^[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+$/.test(word)) return true;
  // camelCase: starts lowercase, has at least one uppercase letter
  if (/^[a-z]+[A-Z]/.test(word)) return true;
  // PascalCase: starts uppercase, has at least one transition to lowercase then uppercase
  if (/^[A-Z][a-z]+[A-Z]/.test(word)) return true;
  // kebab-case with letters: word-word
  if (/^[a-z]+(?:-[a-z]+)+$/.test(word)) return true;
  return false;
}
