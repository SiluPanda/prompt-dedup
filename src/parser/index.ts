import type { PromptInput } from '../types';
import { detectFormat, type DetectedFormat } from './format-detector';
import { detectSections, type Section } from './section-detector';
import { detectVariables, type DetectedVariable, type TemplateSyntax } from './variable-detector';

export interface ParsedPrompt {
  raw: string;
  format: DetectedFormat;
  sections: Section[];
  variables: DetectedVariable[];
}

/**
 * Parse a prompt input into a structured representation.
 */
export function parsePrompt(
  input: PromptInput,
  templateSyntax: TemplateSyntax = 'auto',
): ParsedPrompt {
  const format = detectFormat(input);
  const text = format.text;
  const sections = detectSections(text);
  const variables = detectVariables(text, templateSyntax);

  return {
    raw: text,
    format,
    sections,
    variables,
  };
}

export { detectFormat } from './format-detector';
export { detectSections } from './section-detector';
export { detectVariables } from './variable-detector';
export type { DetectedFormat, Section, DetectedVariable, TemplateSyntax };
