import { detectProtectedRegions } from '../utils/protected-regions';

/**
 * Normalize whitespace in text while preserving protected regions (code blocks).
 *
 * - Replace sequences of whitespace with single space within lines
 * - Trim leading/trailing whitespace per line
 * - Collapse multiple blank lines into a single blank line
 * - Remove leading/trailing blank lines
 * - Normalize line endings to \n
 */
export function normalizeWhitespace(text: string): string {
  if (!text) return '';

  const regions = detectProtectedRegions(text);

  if (regions.length === 0) {
    return finalize(normalizeSegment(text));
  }

  // Process with protected regions
  let result = '';
  let lastEnd = 0;

  for (const region of regions) {
    if (region.start > lastEnd) {
      result += normalizeSegment(text.slice(lastEnd, region.start));
    }
    // Preserve protected region exactly
    result += text.slice(region.start, region.end);
    lastEnd = region.end;
  }

  if (lastEnd < text.length) {
    result += normalizeSegment(text.slice(lastEnd));
  }

  return finalize(result);
}

/**
 * Normalize whitespace within a segment (no protected regions).
 * Normalizes line endings, collapses spaces/tabs, trims lines.
 * Does NOT collapse blank lines or trim overall — that's done in finalize().
 */
function normalizeSegment(text: string): string {
  // Normalize line endings
  let normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  // Process each line: collapse spaces/tabs, trim
  const lines = normalized.split('\n');
  const processedLines = lines.map((line) => {
    return line.replace(/[ \t]+/g, ' ').trim();
  });

  return processedLines.join('\n');
}

/**
 * Final pass: collapse multiple blank lines and trim leading/trailing blank lines.
 */
function finalize(text: string): string {
  // Collapse 3+ consecutive newlines to 2 (which gives one blank line)
  let result = text.replace(/\n{3,}/g, '\n\n');
  // Remove leading/trailing blank lines (trim whole text)
  result = result.trim();
  return result;
}
