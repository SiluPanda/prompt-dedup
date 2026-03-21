import { detectProtectedRegions, isInRegion } from '../utils/protected-regions';

export type TemplateSyntax = 'auto' | 'handlebars' | 'jinja2' | 'fstring' | 'dollar';

export interface DetectedVariable {
  name: string;
  syntax: TemplateSyntax;
  start: number;
  end: number;
  raw: string;
}

const PATTERNS: Record<string, RegExp> = {
  handlebars: /\{\{(\w+)\}\}/g,
  jinja2: /\{\{\s+(\w+)\s+\}\}/g,
  fstring: /\{(\w+)\}/g,
  dollar: /\$\{(\w+)\}|\$(\w+)/g,
};

/**
 * Check if an f-string match is a false positive (JSON or object literal).
 */
function isFstringFalsePositive(text: string, start: number, end: number): boolean {
  // Check for JSON/object literal context: adjacent colons or commas
  const before = text.slice(Math.max(0, start - 5), start);
  const after = text.slice(end, Math.min(text.length, end + 5));

  // Likely JSON if preceded by colon or followed by colon
  if (/:\s*$/.test(before) || /^\s*:/.test(after)) return true;
  // Likely JSON if preceded by comma or followed by comma
  if (/,\s*$/.test(before) || /^\s*,/.test(after)) return true;

  return false;
}

/**
 * Detect the most likely template syntax in the text.
 */
function autoDetectSyntax(text: string): TemplateSyntax {
  // Check in order of specificity
  if (/\{\{\s+\w+\s+\}\}/.test(text)) return 'jinja2';
  if (/\{\{\w+\}\}/.test(text)) return 'handlebars';
  if (/\$\{\w+\}|\$\w+/.test(text)) return 'dollar';
  if (/\{\w+\}/.test(text)) return 'fstring';
  return 'handlebars'; // default
}

/**
 * Detect template variables in text.
 */
export function detectVariables(
  text: string,
  syntax: TemplateSyntax = 'auto',
): DetectedVariable[] {
  if (!text) return [];

  const regions = detectProtectedRegions(text);
  const detectedSyntax = syntax === 'auto' ? autoDetectSyntax(text) : syntax;
  const pattern = PATTERNS[detectedSyntax];
  if (!pattern) return [];

  const regex = new RegExp(pattern.source, pattern.flags);
  const variables: DetectedVariable[] = [];
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    const start = match.index;
    const end = start + match[0].length;

    // Skip if inside protected region
    if (isInRegion(regions, start)) continue;

    // For fstring syntax, check for false positives
    if (detectedSyntax === 'fstring' && isFstringFalsePositive(text, start, end)) {
      continue;
    }

    const name = match[1] || match[2]; // dollar syntax uses group 2 for $var
    variables.push({
      name,
      syntax: detectedSyntax,
      start,
      end,
      raw: match[0],
    });
  }

  return variables;
}
