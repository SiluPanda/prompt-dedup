import type { IndexEntry } from '../types';

/**
 * Manages FIFO eviction when the index exceeds maxSize.
 */
export class EvictionManager {
  private insertionOrder: string[] = [];

  /**
   * Track an entry insertion.
   */
  trackInsertion(hash: string): void {
    this.insertionOrder.push(hash);
  }

  /**
   * Evict oldest entries when size exceeds maxSize.
   * Returns the hashes of evicted entries.
   */
  evict(
    entries: Map<string, IndexEntry>,
    maxSize: number,
  ): string[] {
    const evicted: string[] = [];

    while (entries.size > maxSize && this.insertionOrder.length > 0) {
      const oldestHash = this.insertionOrder.shift()!;
      if (entries.has(oldestHash)) {
        entries.delete(oldestHash);
        evicted.push(oldestHash);
      }
    }

    return evicted;
  }

  /**
   * Clear the insertion order tracking.
   */
  clear(): void {
    this.insertionOrder = [];
  }

  /**
   * Restore insertion order from entries (sorted by addedAt).
   */
  restore(entries: IndexEntry[]): void {
    const sorted = [...entries].sort(
      (a, b) => new Date(a.addedAt).getTime() - new Date(b.addedAt).getTime(),
    );
    this.insertionOrder = sorted.map((e) => e.hash);
  }
}
