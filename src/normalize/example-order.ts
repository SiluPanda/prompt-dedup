import { createHash } from 'node:crypto';

/**
 * Normalize example ordering: sort few-shot examples by content hash.
 */
export function normalizeExampleOrder(text: string): string {
  if (!text) return '';

  // Detect example blocks by numbered patterns
  const exampleRegex = /(?:^|\n)((?:Example\s+\d+\s*[:.]|^\d+[.)]\s).+(?:\n(?!(?:Example\s+\d+\s*[:.]|\d+[.)]\s)).+)*)/gm;
  const examples: Array<{ content: string; start: number; end: number }> = [];

  let match: RegExpExecArray | null;
  while ((match = exampleRegex.exec(text)) !== null) {
    examples.push({
      content: match[1].trim(),
      start: match.index + (match[0].startsWith('\n') ? 1 : 0),
      end: match.index + match[0].length,
    });
  }

  if (examples.length <= 1) return text;

  // Sort examples by their content hash
  const sorted = [...examples].sort((a, b) => {
    const hashA = createHash('sha256').update(a.content).digest('hex');
    const hashB = createHash('sha256').update(b.content).digest('hex');
    return hashA.localeCompare(hashB);
  });

  // Rebuild text with renumbered examples
  let result = text;
  // Replace in reverse order to preserve positions
  for (let i = examples.length - 1; i >= 0; i--) {
    const original = examples[i];
    const replacement = sorted[i].content;
    result = result.slice(0, original.start) + replacement + result.slice(original.end);
  }

  return result;
}
