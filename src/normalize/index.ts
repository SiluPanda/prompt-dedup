import type { NormalizeOptions } from '../types';
import type { PromptInput } from '../types';
import { detectFormat } from '../parser/format-detector';
import { normalizeWhitespace } from './whitespace';
import { normalizeCase } from './case';
import { normalizeVariables } from './variables';
import { normalizeSectionOrder } from './section-order';
import { normalizeExampleOrder } from './example-order';
import { normalizeFormatting } from './formatting';

interface DefaultSteps {
  whitespace: boolean;
  case: boolean;
  variables: boolean;
  'section-order': boolean;
  'example-order': boolean;
  formatting: boolean;
}

const DEFAULT_STEPS: DefaultSteps = {
  whitespace: true,
  case: false,
  variables: true,
  'section-order': false,
  'example-order': false,
  formatting: true,
};

export interface NormalizeResult {
  canonical: string;
  stepsApplied: string[];
}

/**
 * Apply the normalization pipeline to a prompt.
 * Steps execute in fixed order; disabled steps are skipped.
 */
export function normalizePipeline(
  text: string,
  options?: NormalizeOptions,
): NormalizeResult {
  const steps = { ...DEFAULT_STEPS, ...options?.steps };
  const templateSyntax = options?.templateSyntax ?? 'auto';
  const stepsApplied: string[] = [];

  let result = text;

  // Step 1: Whitespace
  if (steps.whitespace) {
    result = normalizeWhitespace(result);
    stepsApplied.push('whitespace');
  }

  // Step 2: Case
  if (steps.case) {
    result = normalizeCase(result);
    stepsApplied.push('case');
  }

  // Step 3: Variables
  if (steps.variables) {
    result = normalizeVariables(result, templateSyntax);
    stepsApplied.push('variables');
  }

  // Step 4: Section order
  if (steps['section-order']) {
    result = normalizeSectionOrder(result);
    stepsApplied.push('section-order');
  }

  // Step 5: Example order
  if (steps['example-order']) {
    result = normalizeExampleOrder(result);
    stepsApplied.push('example-order');
  }

  // Step 6: Formatting
  if (steps.formatting) {
    result = normalizeFormatting(result);
    stepsApplied.push('formatting');
  }

  return { canonical: result, stepsApplied };
}

/**
 * Normalize a prompt input and return its canonical form string.
 */
export function normalize(
  prompt: PromptInput,
  options?: NormalizeOptions,
): string {
  const { text } = detectFormat(prompt);
  const { canonical } = normalizePipeline(text, options);
  return canonical;
}

export {
  normalizeWhitespace,
  normalizeCase,
  normalizeVariables,
  normalizeSectionOrder,
  normalizeExampleOrder,
  normalizeFormatting,
};
