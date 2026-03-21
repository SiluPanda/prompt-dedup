import { detectSections, type Section } from '../parser/section-detector';

/**
 * Normalize section ordering: sort sections alphabetically by title.
 * Sections without titles are left in their original relative order.
 */
export function normalizeSectionOrder(text: string): string {
  if (!text) return '';

  const sections = detectSections(text);
  if (sections.length <= 1) return text;

  // Separate titled and untitled sections
  const titled = sections.filter((s) => s.title);
  const untitled = sections.filter((s) => !s.title);

  if (titled.length <= 1) return text;

  // Sort titled sections alphabetically by title
  titled.sort((a, b) => a.title.localeCompare(b.title));

  // Rebuild text: untitled sections first (preserve order), then sorted titled sections
  const parts: string[] = [];

  for (const s of untitled) {
    parts.push(s.content);
  }

  for (const s of titled) {
    // Reconstruct the section with its header
    const headerMatch = text.slice(s.start, s.end).match(/^(#{1,6}\s+.+)$/m);
    if (headerMatch) {
      parts.push(headerMatch[1] + '\n' + s.content);
    } else {
      // XML or labeled block
      parts.push(s.title + '\n' + s.content);
    }
  }

  return parts.join('\n\n');
}
