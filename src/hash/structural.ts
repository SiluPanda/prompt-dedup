import { detectSections } from '../parser/section-detector';

/**
 * Extract the structural skeleton of a prompt.
 * Preserves role markers, section headers, variable placeholders,
 * and structural delimiters while stripping instructional text.
 */
export function extractSkeleton(text: string): string {
  const lines = text.split('\n');
  const skeletonLines: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();

    // Preserve role markers
    if (/^\[(system|user|assistant|developer)\]$/i.test(trimmed)) {
      skeletonLines.push(trimmed);
      continue;
    }

    // Preserve markdown headers (structural)
    if (/^#{1,6}\s+/.test(trimmed)) {
      skeletonLines.push(trimmed);
      continue;
    }

    // Preserve XML tags
    if (/^<\/?[\w-]+>$/.test(trimmed)) {
      skeletonLines.push(trimmed);
      continue;
    }

    // Preserve lines that are only variable placeholders
    if (/^\{\{VAR_\d+\}\}$/.test(trimmed)) {
      skeletonLines.push(trimmed);
      continue;
    }

    // Preserve lines containing variable placeholders (but strip the text)
    if (/\{\{VAR_\d+\}\}/.test(trimmed)) {
      // Replace non-placeholder text with empty, keep placeholders
      const placeholders = trimmed.match(/\{\{VAR_\d+\}\}/g) || [];
      skeletonLines.push(placeholders.join(' '));
      continue;
    }

    // Empty lines are structural
    if (trimmed === '') {
      skeletonLines.push('');
      continue;
    }

    // All other text is stripped (replaced with empty line marker)
    skeletonLines.push('[TEXT]');
  }

  // Collapse consecutive [TEXT] markers
  const collapsed: string[] = [];
  let lastWasText = false;
  for (const line of skeletonLines) {
    if (line === '[TEXT]') {
      if (!lastWasText) {
        collapsed.push(line);
        lastWasText = true;
      }
    } else {
      collapsed.push(line);
      lastWasText = false;
    }
  }

  return collapsed.join('\n').trim();
}
