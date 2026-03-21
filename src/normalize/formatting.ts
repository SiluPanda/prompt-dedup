import { detectProtectedRegions, transformUnprotected } from '../utils/protected-regions';

/**
 * Normalize formatting: strip markdown formatting markers.
 * - Bold: **text** -> text
 * - Italic: *text* or _text_ -> text
 * - Strikethrough: ~~text~~ -> text
 * - Inline code backticks (around non-code)
 * - List markers: *, +  -> -
 * - Numbered list markers: 1), (1) -> 1.
 * - Horizontal rules: ---, ***, ___
 */
export function normalizeFormatting(text: string): string {
  if (!text) return '';

  const regions = detectProtectedRegions(text);

  return transformUnprotected(text, regions, (segment) => {
    let result = segment;

    // Remove horizontal rules (lines that are only ---, ***, ___)
    result = result.replace(/^[ \t]*(?:[-*_]){3,}[ \t]*$/gm, '');

    // Strip bold: **text** -> text
    result = result.replace(/\*\*([^*]+)\*\*/g, '$1');

    // Strip strikethrough: ~~text~~ -> text
    result = result.replace(/~~([^~]+)~~/g, '$1');

    // Strip italic with underscores: _text_ -> text (but not in identifiers)
    result = result.replace(/(?<!\w)_([^_]+)_(?!\w)/g, '$1');

    // Strip italic with asterisks: *text* -> text (but not list markers)
    result = result.replace(/(?<!\n)(?<!^)\*([^*\n]+)\*/gm, '$1');

    // Normalize list markers: *, + at start of line -> -
    result = result.replace(/^([ \t]*)[*+]\s/gm, '$1- ');

    // Normalize numbered list markers: 1) or (1) -> 1.
    result = result.replace(/^([ \t]*)(\d+)\)\s/gm, '$1$2. ');
    result = result.replace(/^([ \t]*)\((\d+)\)\s/gm, '$1$2. ');

    return result;
  });
}
