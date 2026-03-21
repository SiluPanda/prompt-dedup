/**
 * Tokenize text into word tokens by splitting on whitespace and punctuation.
 */
export function tokenize(text: string): string[] {
  if (!text) return [];
  // Split on whitespace and punctuation, keeping words
  return text
    .split(/[\s\p{P}]+/u)
    .filter((t) => t.length > 0);
}

/**
 * Split text into lines.
 */
export function splitLines(text: string): string[] {
  return text.split(/\r?\n/);
}

/**
 * Split text into words on whitespace only.
 */
export function wordSplit(text: string): string[] {
  if (!text) return [];
  return text.split(/\s+/).filter((w) => w.length > 0);
}
