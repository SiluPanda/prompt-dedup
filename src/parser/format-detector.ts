import type { PromptInput, PromptMessage, AnthropicPrompt } from '../types';

export type PromptFormat = 'plain' | 'messages' | 'anthropic' | 'file';

export interface DetectedFormat {
  format: PromptFormat;
  text: string;
}

function isPromptMessageArray(input: unknown): input is PromptMessage[] {
  return (
    Array.isArray(input) &&
    input.length > 0 &&
    typeof input[0] === 'object' &&
    input[0] !== null &&
    'role' in input[0] &&
    'content' in input[0]
  );
}

function isAnthropicPrompt(input: unknown): input is AnthropicPrompt {
  return (
    typeof input === 'object' &&
    input !== null &&
    'system' in input &&
    'messages' in input &&
    typeof (input as AnthropicPrompt).system === 'string' &&
    Array.isArray((input as AnthropicPrompt).messages)
  );
}

function isFileInput(input: unknown): input is { file: string } {
  return (
    typeof input === 'object' &&
    input !== null &&
    'file' in input &&
    typeof (input as { file: string }).file === 'string' &&
    !('system' in input) &&
    !('role' in input)
  );
}

/**
 * Detect the format of a prompt input and extract its text content.
 */
export function detectFormat(input: PromptInput): DetectedFormat {
  if (typeof input === 'string') {
    return { format: 'plain', text: input };
  }

  if (isPromptMessageArray(input)) {
    const text = input
      .map((msg) => `[${msg.role}]\n${msg.content}`)
      .join('\n\n');
    return { format: 'messages', text };
  }

  if (isAnthropicPrompt(input)) {
    let text = `[system]\n${input.system}`;
    for (const msg of input.messages) {
      text += `\n\n[${msg.role}]\n${msg.content}`;
    }
    return { format: 'anthropic', text };
  }

  if (isFileInput(input)) {
    // For file inputs, we read synchronously
    const fs = require('node:fs');
    const content = fs.readFileSync(input.file, 'utf-8');
    return { format: 'file', text: content };
  }

  return { format: 'plain', text: String(input) };
}
