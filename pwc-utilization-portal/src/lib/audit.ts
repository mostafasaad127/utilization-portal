import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { requestMeta, type CurrentUser } from "@/lib/session";

type Tx = Prisma.TransactionClient | typeof db;

export type AuditEntry = {
  action: string;
  entityType: string;
  entityId?: string | null;
  summary: string;
  changes?: Prisma.InputJsonValue;
};

/** Writes an audit row. Pass the transaction client so the log commits with the change. */
export async function audit(tx: Tx, actor: CurrentUser, entry: AuditEntry) {
  const meta = await requestMeta();
  await tx.auditLog.create({
    data: {
      actorId: actor.id,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId ?? null,
      summary: entry.summary,
      changes: entry.changes,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    },
  });
}

/** Field-level diff of two flat records, for readable audit history. */
export function diff<T extends Record<string, unknown>>(before: T, after: Partial<T>) {
  const changes: Record<string, { from: unknown; to: unknown }> = {};
  for (const key of Object.keys(after)) {
    const a = normalise(before[key]);
    const b = normalise(after[key]);
    if (JSON.stringify(a) !== JSON.stringify(b)) changes[key] = { from: a, to: b };
  }
  return changes;
}

function normalise(v: unknown) {
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return v ?? null;
}
