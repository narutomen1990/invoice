import type { DB } from "@/db/client";
import { documentJournals } from "@/db/schema";
import type { SessionPayload } from "@/lib/auth/session";

export async function writeJournal(
  tx: DB,
  opts: {
    documentId: number;
    action: "create" | "update" | "cancel" | "void" | "print" | "email" | "restore";
    user: SessionPayload | null;
    changes?: Record<string, unknown>;
  },
): Promise<void> {
  await tx.insert(documentJournals).values({
    documentId: opts.documentId,
    action: opts.action,
    userId: opts.user?.userId ?? null,
    userNameSnapshot: opts.user?.fullName ?? opts.user?.username ?? null,
    changes: (opts.changes ?? {}) as Record<string, unknown>,
  });
}
