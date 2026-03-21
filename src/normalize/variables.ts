import { detectVariables, type TemplateSyntax } from '../parser/variable-detector';

/**
 * Normalize template variables: replace all template variables with
 * canonical numbered placeholders {{VAR_0}}, {{VAR_1}}, etc.
 * Same variable name maps to the same placeholder.
 */
export function normalizeVariables(
  text: string,
  templateSyntax: TemplateSyntax = 'auto',
): string {
  if (!text) return '';

  const variables = detectVariables(text, templateSyntax);
  if (variables.length === 0) return text;

  // Build name-to-placeholder mapping based on order of first appearance
  const nameToPlaceholder = new Map<string, string>();
  let counter = 0;

  for (const v of variables) {
    if (!nameToPlaceholder.has(v.name)) {
      nameToPlaceholder.set(v.name, `{{VAR_${counter}}}`);
      counter++;
    }
  }

  // Replace variables in reverse order to preserve positions
  const sortedVars = [...variables].sort((a, b) => b.start - a.start);
  let result = text;
  for (const v of sortedVars) {
    const placeholder = nameToPlaceholder.get(v.name)!;
    result = result.slice(0, v.start) + placeholder + result.slice(v.end);
  }

  return result;
}
