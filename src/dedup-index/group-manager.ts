import type { DedupGroup } from '../types';

/**
 * Manages dedup groups: creation, membership tracking, and lookups.
 */
export class GroupManager {
  private counter = 0;
  private groupsMap = new Map<string, DedupGroup>();
  private hashToGroup = new Map<string, string>();

  /**
   * Create a new group with a canonical member.
   */
  createGroup(canonicalHash: string): string {
    this.counter++;
    const groupId = `g${this.counter}`;

    this.groupsMap.set(groupId, {
      groupId,
      canonical: canonicalHash,
      members: [canonicalHash],
      count: 1,
    });

    this.hashToGroup.set(canonicalHash, groupId);
    return groupId;
  }

  /**
   * Add a member to an existing group.
   */
  addToGroup(groupId: string, hash: string): void {
    const group = this.groupsMap.get(groupId);
    if (group) {
      group.members.push(hash);
      group.count = group.members.length;
      this.hashToGroup.set(hash, groupId);
    }
  }

  /**
   * Get the group ID for a hash.
   */
  getGroupForHash(hash: string): string | undefined {
    return this.hashToGroup.get(hash);
  }

  /**
   * Get all groups.
   */
  getAllGroups(): DedupGroup[] {
    return Array.from(this.groupsMap.values());
  }

  /**
   * Get groups with more than one member.
   */
  getDuplicateGroups(): DedupGroup[] {
    return this.getAllGroups().filter((g) => g.count > 1);
  }

  /**
   * Get total number of groups.
   */
  groupCount(): number {
    return this.groupsMap.size;
  }

  /**
   * Clear all groups.
   */
  clear(): void {
    this.counter = 0;
    this.groupsMap.clear();
    this.hashToGroup.clear();
  }

  /**
   * Restore groups from serialized data.
   */
  restore(groups: DedupGroup[]): void {
    let maxCounter = 0;
    for (const group of groups) {
      this.groupsMap.set(group.groupId, { ...group });
      for (const hash of group.members) {
        this.hashToGroup.set(hash, group.groupId);
      }
      const num = parseInt(group.groupId.slice(1), 10);
      if (num > maxCounter) maxCounter = num;
    }
    this.counter = maxCounter;
  }
}
