/**
 * Compute normalized Levenshtein edit distance similarity.
 * Returns 1 - (distance / max(len(a), len(b))).
 *
 * For strings exceeding maxLength, uses a faster prefix/suffix estimate.
 */
export function editDistanceSimilarity(
  a: string,
  b: string,
  maxLength: number = 10000,
): number {
  if (a === b) return 1.0;
  if (a.length === 0 && b.length === 0) return 1.0;
  if (a.length === 0 || b.length === 0) return 0.0;

  const maxLen = Math.max(a.length, b.length);

  // For very long strings, use prefix/suffix estimate
  if (maxLen > maxLength) {
    return prefixSuffixEstimate(a, b);
  }

  const distance = levenshtein(a, b);
  return 1 - distance / maxLen;
}

/**
 * Standard Levenshtein distance using dynamic programming.
 * Optimized to use O(min(n,m)) space.
 */
function levenshtein(a: string, b: string): number {
  // Ensure a is the shorter string for space optimization
  if (a.length > b.length) {
    [a, b] = [b, a];
  }

  const m = a.length;
  const n = b.length;

  let prev = new Array(m + 1);
  let curr = new Array(m + 1);

  for (let i = 0; i <= m; i++) {
    prev[i] = i;
  }

  for (let j = 1; j <= n; j++) {
    curr[0] = j;
    for (let i = 1; i <= m; i++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[i] = Math.min(
        prev[i] + 1,      // deletion
        curr[i - 1] + 1,  // insertion
        prev[i - 1] + cost // substitution
      );
    }
    [prev, curr] = [curr, prev];
  }

  return prev[m];
}

/**
 * Fast prefix/suffix matching estimate for very long strings.
 */
function prefixSuffixEstimate(a: string, b: string): number {
  const maxLen = Math.max(a.length, b.length);
  const checkLen = Math.min(1000, Math.min(a.length, b.length));

  // Count matching prefix characters
  let prefixMatch = 0;
  for (let i = 0; i < checkLen; i++) {
    if (a[i] === b[i]) prefixMatch++;
    else break;
  }

  // Count matching suffix characters
  let suffixMatch = 0;
  for (let i = 0; i < checkLen; i++) {
    if (a[a.length - 1 - i] === b[b.length - 1 - i]) suffixMatch++;
    else break;
  }

  const matchedChars = prefixMatch + suffixMatch;
  return Math.min(1.0, matchedChars / maxLen);
}
