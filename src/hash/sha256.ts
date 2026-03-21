import { createHash } from 'node:crypto';

/**
 * Compute SHA-256 hash of a string, returning a 64-character hex string.
 */
export function sha256(input: string): string {
  return createHash('sha256').update(input, 'utf-8').digest('hex');
}
