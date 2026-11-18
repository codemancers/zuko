/**
 * Pure reporting-line logic. Ids are compared as strings, because adapters return
 * them as numbers, bigints or strings depending on the database.
 */
export type Id = string;

export interface ReportingRow {
  userId: Id;
  managerId: Id | null;
}

export interface ClosureRow {
  ancestorId: Id;
  descendantId: Id;
  /** 1 = direct report */
  depth: number;
}

/**
 * Each member's effective manager: the nearest manager up their reporting chain who
 * is still a member. A manager who left the organization is skipped, so their reports
 * move up to the next manager instead of dropping out of the hierarchy.
 */
export function effectiveManagers(members: ReadonlySet<Id>, reporting: readonly ReportingRow[]): Map<Id, Id | null> {
  const managerOf = new Map<Id, Id | null>(reporting.map((r) => [r.userId, r.managerId]));
  const result = new Map<Id, Id | null>();

  for (const user of members) {
    const seen = new Set<Id>([user]);
    let next = managerOf.get(user) ?? null;
    while (next !== null && !members.has(next) && !seen.has(next)) {
      seen.add(next);
      next = managerOf.get(next) ?? null;
    }
    // Stop at a cycle or a chain that never reaches a current member.
    result.set(user, next !== null && members.has(next) && next !== user ? next : null);
  }
  return result;
}

/** Every (ancestor, descendant, depth) pair, at any level of the organization. */
export function computeClosure(members: ReadonlySet<Id>, reporting: readonly ReportingRow[]): ClosureRow[] {
  const manager = effectiveManagers(members, reporting);
  const rows: ClosureRow[] = [];

  for (const user of members) {
    const seen = new Set<Id>([user]);
    let ancestor = manager.get(user) ?? null;
    let depth = 1;
    while (ancestor !== null && !seen.has(ancestor)) {
      rows.push({ ancestorId: ancestor, descendantId: user, depth });
      seen.add(ancestor);
      ancestor = manager.get(ancestor) ?? null;
      depth += 1;
    }
  }
  return rows;
}

/** True if making `managerId` the manager of `userId` would create a loop. */
export function wouldCreateCycle(reporting: readonly ReportingRow[], userId: Id, managerId: Id): boolean {
  if (userId === managerId) {
    return true;
  }
  const managerOf = new Map<Id, Id | null>(reporting.map((r) => [r.userId, r.managerId]));
  const seen = new Set<Id>();
  let cursor: Id | null = managerId;
  while (cursor !== null && !seen.has(cursor)) {
    if (cursor === userId) {
      return true;
    }
    seen.add(cursor);
    cursor = managerOf.get(cursor) ?? null;
  }
  return false;
}
