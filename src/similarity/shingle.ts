import { wordSplit } from '../utils/text';

/**
 * Compute n-gram shingling similarity between two strings.
 * Decomposes both texts into overlapping n-grams of words,
 * then computes Jaccard similarity on the n-gram sets.
 */
export function shingleSimilarity(
  a: string,
  b: string,
  shingleSize: number = 3,
): number {
  const shinglesA = getShingles(a, shingleSize);
  const shinglesB = getShingles(b, shingleSize);

  if (shinglesA.size === 0 && shinglesB.size === 0) return 1.0;
  if (shinglesA.size === 0 || shinglesB.size === 0) return 0.0;

  let intersection = 0;
  for (const shingle of shinglesA) {
    if (shinglesB.has(shingle)) intersection++;
  }

  const union = shinglesA.size + shinglesB.size - intersection;
  return intersection / union;
}

function getShingles(text: string, n: number): Set<string> {
  const words = wordSplit(text);
  const shingles = new Set<string>();

  if (words.length < n) {
    // If text is shorter than shingle size, use what we have
    if (words.length > 0) {
      shingles.add(words.join(' '));
    }
    return shingles;
  }

  for (let i = 0; i <= words.length - n; i++) {
    shingles.add(words.slice(i, i + n).join(' '));
  }

  return shingles;
}
