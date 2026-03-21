export interface Region {
  start: number;
  end: number;
}

/**
 * Detect protected regions: fenced code blocks and quoted strings.
 * These regions should not be modified by normalization steps.
 */
export function detectProtectedRegions(text: string): Region[] {
  const regions: Region[] = [];

  // Fenced code blocks: ```...```
  const fencedRegex = /```[\s\S]*?```/g;
  let match: RegExpExecArray | null;
  while ((match = fencedRegex.exec(text)) !== null) {
    regions.push({ start: match.index, end: match.index + match[0].length });
  }

  // Quoted strings (double quotes spanning non-trivial content)
  const doubleQuoteRegex = /"[^"\n]{2,}"/g;
  while ((match = doubleQuoteRegex.exec(text)) !== null) {
    // Only add if not inside an already-detected region
    if (!isInRegion(regions, match.index)) {
      regions.push({ start: match.index, end: match.index + match[0].length });
    }
  }

  // Single quoted strings
  const singleQuoteRegex = /'[^'\n]{2,}'/g;
  while ((match = singleQuoteRegex.exec(text)) !== null) {
    if (!isInRegion(regions, match.index)) {
      regions.push({ start: match.index, end: match.index + match[0].length });
    }
  }

  return regions.sort((a, b) => a.start - b.start);
}

/**
 * Check if a position is inside any protected region.
 */
export function isInRegion(regions: Region[], pos: number): boolean {
  for (const r of regions) {
    if (pos >= r.start && pos < r.end) return true;
  }
  return false;
}

/**
 * Apply a transformation function only to unprotected parts of text.
 * Protected regions are preserved as-is.
 */
export function transformUnprotected(
  text: string,
  regions: Region[],
  transform: (segment: string) => string,
): string {
  if (regions.length === 0) return transform(text);

  let result = '';
  let lastEnd = 0;

  for (const region of regions) {
    // Transform unprotected segment before this region
    if (region.start > lastEnd) {
      result += transform(text.slice(lastEnd, region.start));
    }
    // Keep protected region as-is
    result += text.slice(region.start, region.end);
    lastEnd = region.end;
  }

  // Transform remaining unprotected text
  if (lastEnd < text.length) {
    result += transform(text.slice(lastEnd));
  }

  return result;
}
